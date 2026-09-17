use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};
use tokio::sync::mpsc;

use crate::access::DiskAccessStatus;
use crate::scan::{walk_directory, ScanMsg};
use crate::state::{AppState, ScanControl};
use crate::tree::{path_to_string, relative_components, FsNode, NodeDetail, ViewNode};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgress {
    files: u64,
    bytes: u64,
    current: String,
}

#[tauri::command]
pub async fn start_scan(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err("フォルダが見つかりません".into());
    }

    let control = state.begin_scan();
    *state.root.lock().expect("root") = Some(root.clone());
    *state.tree.lock().expect("tree") = Some(FsNode::new_root(root.clone()));

    let app = app.clone();
    let state = state.inner().clone();
    tauri::async_runtime::spawn(async move {
        run_scan(app, state, root, control).await;
    });

    Ok(())
}

async fn run_scan(app: AppHandle, state: AppState, root: PathBuf, control: Arc<ScanControl>) {
    let (tx, mut rx) = mpsc::channel::<ScanMsg>(64);
    let control_for_walk = control.clone();
    let walk_root = root.clone();
    let walk = tokio::task::spawn_blocking(move || {
        walk_directory(walk_root, tx, &control_for_walk.cancel);
    });

    emit_tree(&app, &state);
    let mut last_emit = tokio::time::Instant::now();

    while let Some(message) = rx.recv().await {
        if !state.is_current(&control) {
            break;
        }

        match message {
            ScanMsg::Batch {
                entries,
                files,
                bytes,
                current,
            } => {
                {
                    let mut tree = state.tree.lock().expect("tree");
                    if let Some(root_node) = tree.as_mut() {
                        for entry in entries {
                            root_node.insert_file(&entry.components, entry.size);
                        }
                    }
                }
                let _ = app.emit(
                    "scan-progress",
                    ScanProgress {
                        files,
                        bytes,
                        current,
                    },
                );
                if last_emit.elapsed() >= Duration::from_millis(100) {
                    emit_tree(&app, &state);
                    last_emit = tokio::time::Instant::now();
                }
            }
            ScanMsg::Done { files, bytes } => {
                let _ = app.emit(
                    "scan-progress",
                    ScanProgress {
                        files,
                        bytes,
                        current: path_to_string(&root),
                    },
                );
                emit_tree(&app, &state);
                let _ = app.emit("scan-done", ());
            }
        }
    }

    let _ = walk.await;
}

fn emit_tree(app: &AppHandle, state: &AppState) {
    let view = state
        .tree
        .lock()
        .expect("tree")
        .as_ref()
        .map(FsNode::to_view);
    if let Some(view) = view {
        let _ = app.emit("scan-tree", view);
    }
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel_scan();
    Ok(())
}

#[tauri::command]
pub fn get_view(state: State<'_, AppState>, path: String) -> Result<ViewNode, String> {
    with_node(&state, &path, FsNode::to_view)
}

#[tauri::command]
pub fn get_node(state: State<'_, AppState>, path: String) -> Result<NodeDetail, String> {
    with_node(&state, &path, FsNode::to_detail)
}

#[tauri::command]
pub fn trash_path(state: State<'_, AppState>, path: String) -> Result<ViewNode, String> {
    let target = PathBuf::from(&path);
    let root_path = locked_root(&state)?;
    if target == root_path {
        return Err("走査中のルートは削除できません".into());
    }

    trash::delete(&target).map_err(|error| error.to_string())?;

    let mut tree = state.tree.lock().expect("tree");
    let root = tree
        .as_mut()
        .ok_or_else(|| "まだ走査していません".to_string())?;
    let components = relative_components(&root_path, &target)?;
    root.remove_path(&components)
        .ok_or_else(|| "対象が見つかりません".to_string())?;
    Ok(root.to_view())
}

#[tauri::command]
pub fn rename_path(
    state: State<'_, AppState>,
    path: String,
    new_name: String,
) -> Result<ViewNode, String> {
    validate_file_name(&new_name)?;

    let target = PathBuf::from(&path);
    let root_path = locked_root(&state)?;
    if target == root_path {
        return Err("走査中のルートは名前を変更できません".into());
    }

    let destination = target
        .parent()
        .ok_or_else(|| "親フォルダがありません".to_string())?
        .join(&new_name);
    std::fs::rename(&target, &destination).map_err(|error| error.to_string())?;

    let mut tree = state.tree.lock().expect("tree");
    let root = tree
        .as_mut()
        .ok_or_else(|| "まだ走査していません".to_string())?;
    let components = relative_components(&root_path, &target)?;
    root.rename_child(&components, &new_name)?;
    Ok(root.to_view())
}

fn with_node<T>(
    state: &AppState,
    path: &str,
    map: fn(&FsNode) -> T,
) -> Result<T, String> {
    let root_path = locked_root(state)?;
    let tree = state.tree.lock().expect("tree");
    let root = tree
        .as_ref()
        .ok_or_else(|| "まだ走査していません".to_string())?;
    let components = relative_components(&root_path, Path::new(path))?;
    let node = root
        .find(&components)
        .ok_or_else(|| "対象が見つかりません".to_string())?;
    Ok(map(node))
}

fn locked_root(state: &AppState) -> Result<PathBuf, String> {
    state
        .root
        .lock()
        .expect("root")
        .clone()
        .ok_or_else(|| "まだ走査していません".to_string())
}

#[tauri::command]
pub fn disk_access_status() -> DiskAccessStatus {
    crate::access::status()
}

#[tauri::command]
pub fn get_volume_info(path: String) -> Result<crate::volume::VolumeInfo, String> {
    crate::volume::query(Path::new(&path))
}

#[tauri::command]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    crate::access::open_settings()
}

fn validate_file_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("名前が空です".into());
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err("名前に使えない文字が含まれています".into());
    }
    if name == "." || name == ".." {
        return Err("その名前には変更できません".into());
    }
    Ok(())
}
