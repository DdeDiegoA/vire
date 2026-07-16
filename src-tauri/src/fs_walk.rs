// fs_walk module - Vire backend
// File tree + quick-open file listing for the Editor block and Cmd+K
// palette. Uses the `ignore` crate (same engine ripgrep uses) so both
// respect .gitignore/.git without hand-rolled exclude lists.
use ignore::WalkBuilder;
use std::time::UNIX_EPOCH;

#[derive(serde::Serialize)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

// One directory level, dirs first then alpha — used to lazily expand the
// Editor's file tree without walking the whole project up front.
#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FsEntry>, String> {
    let mut entries: Vec<FsEntry> = WalkBuilder::new(&path)
        .max_depth(Some(1))
        .hidden(false)
        .build()
        .filter_map(|r| r.ok())
        .filter(|e| e.path().to_string_lossy() != path)
        .map(|e| FsEntry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            is_dir: e.file_type().map(|t| t.is_dir()).unwrap_or(false),
        })
        .collect();
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(entries)
}

// Full recursive listing (respects .gitignore) for the Cmd+K fuzzy file
// source. ponytail: hard cap instead of streaming/paginating — a repo with
// >20k tracked files is rare enough that truncating is an acceptable
// ceiling; revisit with an incremental walker if that stops being true.
#[tauri::command]
pub fn walk_project_files(root: String) -> Result<Vec<String>, String> {
    const LIMIT: usize = 20_000;
    let base = std::path::Path::new(&root);
    let mut out = Vec::new();
    for result in WalkBuilder::new(&root).hidden(false).build() {
        let Ok(entry) = result else { continue };
        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        if let Ok(rel) = entry.path().strip_prefix(base) {
            out.push(rel.to_string_lossy().into_owned());
        }
        if out.len() >= LIMIT {
            break;
        }
    }
    Ok(out)
}

// Modified time in epoch millis — polled by the Editor to detect external
// changes (e.g. an agent CLI writing the same file) while a tab is open.
#[tauri::command]
pub fn file_mtime(path: String) -> Result<u64, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified = meta.modified().map_err(|e| e.to_string())?;
    let ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    Ok(ms)
}
