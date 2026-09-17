use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

const MAX_SUNBURST_CHILDREN: usize = 24;
const MAX_SUNBURST_DEPTH: usize = 4;
const MAX_DETAIL_CHILDREN: usize = 200;

#[derive(Debug, Clone)]
pub struct FsNode {
    pub path: PathBuf,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub file_count: u64,
    pub children: HashMap<String, FsNode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewNode {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub file_count: u64,
    pub is_other: bool,
    pub children: Vec<ViewNode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeChild {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub file_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeDetail {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub file_count: u64,
    pub modified: Option<i64>,
    pub child_total: usize,
    pub children: Vec<NodeChild>,
}

impl FsNode {
    pub fn new_root(path: PathBuf) -> Self {
        let name = path
            .file_name()
            .map(|value| value.to_string_lossy().into_owned())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| path.to_string_lossy().into_owned());
        Self {
            path,
            name,
            is_dir: true,
            size: 0,
            file_count: 0,
            children: HashMap::new(),
        }
    }

    pub fn insert_file(&mut self, components: &[String], size: u64) {
        self.size = self.size.saturating_add(size);
        self.file_count = self.file_count.saturating_add(1);
        if components.is_empty() {
            return;
        }

        let name = &components[0];
        let child_path = self.path.join(name);
        let child = self
            .children
            .entry(name.clone())
            .or_insert_with(|| FsNode {
                path: child_path,
                name: name.clone(),
                is_dir: components.len() > 1,
                size: 0,
                file_count: 0,
                children: HashMap::new(),
            });

        if components.len() == 1 {
            child.size = child.size.saturating_add(size);
            child.file_count = child.file_count.saturating_add(1);
            return;
        }

        child.is_dir = true;
        child.insert_file(&components[1..], size);
    }

    pub fn find(&self, components: &[String]) -> Option<&FsNode> {
        if components.is_empty() {
            return Some(self);
        }
        self.children.get(&components[0])?.find(&components[1..])
    }

    pub fn remove_path(&mut self, components: &[String]) -> Option<FsNode> {
        if components.is_empty() {
            return None;
        }
        if components.len() == 1 {
            let removed = self.children.remove(&components[0])?;
            self.size = self.size.saturating_sub(removed.size);
            self.file_count = self.file_count.saturating_sub(removed.file_count);
            return Some(removed);
        }

        let child = self.children.get_mut(&components[0])?;
        let removed = child.remove_path(&components[1..])?;
        self.size = self.size.saturating_sub(removed.size);
        self.file_count = self.file_count.saturating_sub(removed.file_count);
        Some(removed)
    }

    pub fn rename_child(&mut self, components: &[String], new_name: &str) -> Result<PathBuf, String> {
        if components.is_empty() {
            return Err("走査ルートは名前を変更できません".into());
        }
        if components.len() == 1 {
            if self.children.contains_key(new_name) {
                return Err("同じ名前の項目が既にあります".into());
            }
            let mut node = self
                .children
                .remove(&components[0])
                .ok_or_else(|| "対象が見つかりません".to_string())?;
            let new_path = self.path.join(new_name);
            rewrite_paths(&mut node, &new_path, new_name);
            self.children.insert(new_name.to_string(), node);
            return Ok(new_path);
        }

        self.children
            .get_mut(&components[0])
            .ok_or_else(|| "対象が見つかりません".to_string())?
            .rename_child(&components[1..], new_name)
    }

    pub fn to_view(&self) -> ViewNode {
        prune(self, 0)
    }

    pub fn to_detail(&self) -> NodeDetail {
        let mut children: Vec<&FsNode> = self.children.values().collect();
        children.sort_by(|left, right| right.size.cmp(&left.size).then(left.name.cmp(&right.name)));
        let child_total = children.len();
        let children = children
            .into_iter()
            .take(MAX_DETAIL_CHILDREN)
            .map(|child| NodeChild {
                path: path_to_string(&child.path),
                name: child.name.clone(),
                is_dir: child.is_dir,
                size: child.size,
                file_count: child.file_count,
            })
            .collect();

        NodeDetail {
            path: path_to_string(&self.path),
            name: self.name.clone(),
            is_dir: self.is_dir,
            size: self.size,
            file_count: self.file_count,
            modified: modified_unix(&self.path),
            child_total,
            children,
        }
    }
}

pub fn relative_components(root: &Path, path: &Path) -> Result<Vec<String>, String> {
    if path == root {
        return Ok(Vec::new());
    }
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "走査対象の外にあるパスです".to_string())?;
    Ok(relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect())
}

pub fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn prune(node: &FsNode, depth: usize) -> ViewNode {
    let mut children: Vec<&FsNode> = node.children.values().collect();
    children.sort_by(|left, right| right.size.cmp(&left.size).then(left.name.cmp(&right.name)));

    let mut view_children = Vec::new();
    if depth < MAX_SUNBURST_DEPTH {
        let mut other_size = 0_u64;
        let mut other_count = 0_u64;
        let mut other_items = 0_usize;

        for (index, child) in children.into_iter().enumerate() {
            if index < MAX_SUNBURST_CHILDREN {
                view_children.push(prune(child, depth + 1));
                continue;
            }
            other_size = other_size.saturating_add(child.size);
            other_count = other_count.saturating_add(child.file_count);
            other_items += 1;
        }

        if other_items > 0 {
            view_children.push(ViewNode {
                path: format!("{}/*", path_to_string(&node.path)),
                name: format!("その他 ({other_items}件)"),
                is_dir: true,
                size: other_size,
                file_count: other_count,
                is_other: true,
                children: Vec::new(),
            });
        }
    }

    ViewNode {
        path: path_to_string(&node.path),
        name: node.name.clone(),
        is_dir: node.is_dir,
        size: node.size,
        file_count: node.file_count,
        is_other: false,
        children: view_children,
    }
}

fn rewrite_paths(node: &mut FsNode, new_path: &Path, new_name: &str) {
    node.path = new_path.to_path_buf();
    node.name = new_name.to_string();
    let child_names: Vec<String> = node.children.keys().cloned().collect();
    for child_name in child_names {
        if let Some(child) = node.children.get_mut(&child_name) {
            let child_path = new_path.join(&child_name);
            let next_name = child.name.clone();
            rewrite_paths(child, &child_path, &next_name);
        }
    }
}

fn modified_unix(path: &Path) -> Option<i64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    let duration = modified.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(duration.as_secs() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_file_rolls_size_up_to_root() {
        let mut root = FsNode::new_root(PathBuf::from("/tmp/root"));
        root.insert_file(&["docs".into(), "a.txt".into()], 100);
        root.insert_file(&["docs".into(), "b.txt".into()], 50);
        assert_eq!(root.size, 150);
        assert_eq!(root.file_count, 2);
        assert_eq!(root.children["docs"].size, 150);
        assert_eq!(root.children["docs"].children["a.txt"].size, 100);
    }

    #[test]
    fn remove_and_rename_update_paths() {
        let mut root = FsNode::new_root(PathBuf::from("/tmp/root"));
        root.insert_file(&["docs".into(), "a.txt".into()], 100);
        root.insert_file(&["docs".into(), "b.txt".into()], 50);
        root.remove_path(&["docs".into(), "b.txt".into()]);
        assert_eq!(root.size, 100);
        let new_path = root
            .rename_child(&["docs".into()], "notes")
            .expect("rename");
        assert_eq!(new_path, PathBuf::from("/tmp/root/notes"));
        assert!(root.children.contains_key("notes"));
        assert_eq!(
            root.children["notes"].children["a.txt"].path,
            PathBuf::from("/tmp/root/notes/a.txt")
        );
    }
}
