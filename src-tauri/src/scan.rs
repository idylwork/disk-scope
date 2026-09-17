use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use jwalk::WalkDir;
use tokio::sync::mpsc::Sender;

pub struct RawEntry {
    pub components: Vec<String>,
    pub size: u64,
}

pub enum ScanMsg {
    Batch {
        entries: Vec<RawEntry>,
        files: u64,
        bytes: u64,
        current: String,
    },
    Done {
        files: u64,
        bytes: u64,
    },
}

const BATCH_SIZE: usize = 256;
const BATCH_INTERVAL: Duration = Duration::from_millis(40);

/// jwalk は同期 API なので `spawn_blocking` 側から呼ぶ。
/// 描画側が追いつかないときは bounded channel の `blocking_send` で背圧をかける。
pub fn walk_directory(root: PathBuf, tx: Sender<ScanMsg>, cancel: &AtomicBool) {
    let mut batch = Vec::with_capacity(BATCH_SIZE);
    let mut files = 0_u64;
    let mut bytes = 0_u64;
    let mut last_flush = Instant::now();

    let walker = WalkDir::new(&root)
        .follow_links(false)
        .skip_hidden(false)
        .sort(false);

    for entry in walker {
        if cancel.load(Ordering::Relaxed) {
            return;
        }

        let entry = match entry {
            Ok(value) => value,
            Err(_) => continue,
        };

        let file_type = entry.file_type();
        if file_type.is_dir() || file_type.is_symlink() {
            continue;
        }

        let metadata = match entry.metadata() {
            Ok(value) => value,
            Err(_) => continue,
        };
        let size = disk_usage(&metadata);
        let path = entry.path();
        let components = match crate::tree::relative_components(&root, &path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        files = files.saturating_add(1);
        bytes = bytes.saturating_add(size);
        batch.push(RawEntry { components, size });

        if batch.len() >= BATCH_SIZE || last_flush.elapsed() >= BATCH_INTERVAL {
            if !flush_batch(&tx, &mut batch, files, bytes, &path) {
                return;
            }
            last_flush = Instant::now();
        }
    }

    if !batch.is_empty() && !flush_batch(&tx, &mut batch, files, bytes, &root) {
        return;
    }

    let _ = tx.blocking_send(ScanMsg::Done { files, bytes });
}

fn flush_batch(
    tx: &Sender<ScanMsg>,
    batch: &mut Vec<RawEntry>,
    files: u64,
    bytes: u64,
    current: &Path,
) -> bool {
    tx.blocking_send(ScanMsg::Batch {
        entries: std::mem::take(batch),
        files,
        bytes,
        current: crate::tree::path_to_string(current),
    })
    .is_ok()
}

fn disk_usage(metadata: &std::fs::Metadata) -> u64 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        metadata.blocks().saturating_mul(512)
    }
    #[cfg(not(unix))]
    {
        metadata.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use tokio::sync::mpsc;

    #[test]
    fn walk_directory_batches_file_entries() {
        let dir = std::env::temp_dir().join(format!("disk-scope-walk-{}", std::process::id()));
        fs::create_dir_all(dir.join("sub")).expect("create fixture");
        fs::write(dir.join("a.bin"), vec![0_u8; 2048]).expect("write file");
        fs::write(dir.join("sub").join("b.bin"), vec![0_u8; 4096]).expect("write file");

        let (tx, mut rx) = mpsc::channel(8);
        let cancel = AtomicBool::new(false);
        let root = dir.clone();
        let worker = std::thread::spawn(move || walk_directory(root, tx, &cancel));

        let mut files = 0_u64;
        let mut bytes = 0_u64;
        while let Some(message) = rx.blocking_recv() {
            match message {
                ScanMsg::Batch {
                    files: next_files,
                    bytes: next_bytes,
                    ..
                }
                | ScanMsg::Done {
                    files: next_files,
                    bytes: next_bytes,
                } => {
                    files = next_files;
                    bytes = next_bytes;
                }
            }
        }
        worker.join().expect("walk thread");
        let _ = fs::remove_dir_all(&dir);

        assert_eq!(files, 2);
        assert!(bytes >= 6144);
    }
}
