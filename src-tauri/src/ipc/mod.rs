// ipc module - Vire backend
use crate::process::ProcessManager;
use crate::project::ProjectManager;
use tauri::{ipc::Channel, State};

// Opens a terminal: if a session for this surface_id is already running
// (e.g. reopening a project after switching away — the block unmounted but
// the PTY thread kept running), reattaches and replays buffered scrollback.
// Otherwise spawns a fresh shell. Frontend never has to know which. Raw PTY
// bytes stream through untouched — xterm.js on the frontend does the vt100
// parsing, not this backend.
#[tauri::command]
pub fn open_terminal(
    process: State<ProcessManager>,
    project: State<ProjectManager>,
    surface_id: String,
    project_id: String,
    cols: u16,
    rows: u16,
    on_data: Channel<Vec<u8>>,
    cwd_override: Option<String>,
) -> Result<(), String> {
    if process.exists(&surface_id) {
        return process.attach(&surface_id, move |bytes| {
            let _ = on_data.send(bytes.to_vec());
        });
    }
    let term = project
        .get_config("terminal:type")?
        .filter(|v| v != "auto" && !v.is_empty())
        .unwrap_or_else(|| std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".into()));
    let shell = project
        .get_config("terminal:shell")?
        .filter(|v| v != "auto" && !v.is_empty())
        .unwrap_or_else(crate::process::default_shell);
    let cwd = match cwd_override {
        Some(c) => Some(c),
        None => project.get_repo_path(&project_id)?,
    };
    process.spawn(surface_id.clone(), cols, rows, term, shell.clone(), cwd.clone(), move |bytes| {
        let _ = on_data.send(bytes.to_vec());
    })?;
    project.insert_terminal(&surface_id, &project_id, &surface_id, cwd.as_deref(), &shell)?;

    // A resume command left by a real app quit (see agent_resume) — type it
    // into the fresh shell once, then forget it so a later quit-without-agent
    // doesn't leave a stale resume for next time.
    if let Some(cmd) = project.get_agent_resume(&surface_id)? {
        let _ = process.input(&surface_id, format!("{cmd}\n").into_bytes());
        project.clear_agent_resume(&surface_id)?;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_ports(process: State<ProcessManager>, surface_id: String) -> Vec<u16> {
    process.listening_ports(&surface_id)
}

#[tauri::command]
pub fn list_shells() -> Vec<String> {
    crate::process::list_shells()
}

#[tauri::command]
pub fn terminal_input(
    state: State<ProcessManager>,
    surface_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state.input(&surface_id, data)
}

#[tauri::command]
pub fn resize_terminal(
    state: State<ProcessManager>,
    surface_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&surface_id, cols, rows)
}

#[tauri::command]
pub fn close_terminal(process: State<ProcessManager>, project: State<ProjectManager>, surface_id: String) -> Result<(), String> {
    process.close(&surface_id)?;
    project.delete_terminal(&surface_id)
}

// Scrollback persisted right before the last real quit (tray "Salir") — only
// relevant when open_terminal is spawning a *fresh* PTY (no live session to
// reattach to), so the frontend can replay history from a process that no
// longer exists.
#[tauri::command]
pub fn get_terminal_scrollback(project: State<ProjectManager>, surface_id: String) -> Result<Option<Vec<u8>>, String> {
    project.get_scrollback(&surface_id)
}

#[derive(serde::Serialize)]
pub struct ScrollbackHit {
    pub surface_id: String,
    pub line: String,
}

// Cmd+K "search terminal scrollback" source. Scrollback is raw PTY bytes
// (text + ANSI escapes) — lossy UTF-8 decode is fine here since we're only
// matching literal substrings, not rendering the escape codes.
#[tauri::command]
pub fn search_scrollback(project: State<ProjectManager>, project_id: String, query: String) -> Result<Vec<ScrollbackHit>, String> {
    const LIMIT: usize = 20;
    let needle = query.to_lowercase();
    if needle.is_empty() {
        return Ok(vec![]);
    }
    let mut hits = Vec::new();
    'outer: for (surface_id, bytes) in project.scrollback_by_project(&project_id)? {
        let text = String::from_utf8_lossy(&bytes);
        for line in text.lines() {
            if line.to_lowercase().contains(&needle) {
                hits.push(ScrollbackHit { surface_id: surface_id.clone(), line: line.to_string() });
                if hits.len() >= LIMIT {
                    break 'outer;
                }
            }
        }
    }
    Ok(hits)
}

#[derive(serde::Serialize)]
pub struct ProjectDto {
    pub id: String,
    pub name: String,
    pub repo_path: Option<String>,
}

#[tauri::command]
pub fn list_projects(state: State<ProjectManager>) -> Result<Vec<ProjectDto>, String> {
    Ok(state
        .list_projects()?
        .into_iter()
        .map(|p| ProjectDto { id: p.id, name: p.name, repo_path: p.repo_path })
        .collect())
}

#[tauri::command]
pub fn upsert_project(
    state: State<ProjectManager>,
    id: String,
    name: String,
    repo_path: Option<String>,
) -> Result<(), String> {
    state.upsert_project(&id, &name, repo_path.as_deref())
}

#[tauri::command]
pub fn delete_project(state: State<ProjectManager>, id: String) -> Result<(), String> {
    state.delete_project(&id)
}

#[tauri::command]
pub fn save_board(state: State<ProjectManager>, project_id: String, blocks_json: String, camera_json: String) -> Result<(), String> {
    state.save_board(&project_id, &blocks_json, &camera_json)
}

#[derive(serde::Serialize)]
pub struct BoardDto {
    pub blocks_json: String,
    pub camera_json: String,
}

#[tauri::command]
pub fn load_board(state: State<ProjectManager>, project_id: String) -> Result<Option<BoardDto>, String> {
    Ok(state
        .load_board(&project_id)?
        .map(|b| BoardDto { blocks_json: b.blocks_json, camera_json: b.camera_json }))
}

#[tauri::command]
pub fn get_config(state: State<ProjectManager>, key: String) -> Result<Option<String>, String> {
    state.get_config(&key)
}

#[tauri::command]
pub fn run_agent(
    cli: String,
    prompt: String,
    cwd: String,
    session_id: Option<String>,
    on_event: Channel<crate::agent::AgentEvent>,
) -> Result<(), String> {
    crate::agent::spawn_run(cli, prompt, cwd, session_id, move |ev| {
        let _ = on_event.send(ev);
    })
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_config(state: State<ProjectManager>, key: String, value_json: String) -> Result<(), String> {
    state.set_config(&key, &value_json)
}

#[tauri::command]
pub fn git_status(repo_path: String) -> Result<crate::git::GitStatusDto, String> {
    crate::git::status(&repo_path)
}

#[tauri::command]
pub fn git_diff(repo_path: String, file: String, staged: bool, untracked: bool) -> Result<String, String> {
    crate::git::diff(&repo_path, &file, staged, untracked)
}

#[tauri::command]
pub fn git_stage(repo_path: String, files: Vec<String>) -> Result<(), String> {
    crate::git::stage(&repo_path, &files)
}

#[tauri::command]
pub fn git_unstage(repo_path: String, files: Vec<String>) -> Result<(), String> {
    crate::git::unstage(&repo_path, &files)
}

#[tauri::command]
pub fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    crate::git::commit(&repo_path, &message)
}

#[derive(serde::Serialize)]
pub struct WorktreeDto {
    pub id: String,
    pub project_id: String,
    pub path: String,
    pub branch: String,
}

#[tauri::command]
pub fn list_worktrees(state: State<ProjectManager>, project_id: String) -> Result<Vec<WorktreeDto>, String> {
    Ok(state
        .list_worktrees(&project_id)?
        .into_iter()
        .map(|w| WorktreeDto { id: w.id, project_id: w.project_id, path: w.path, branch: w.branch })
        .collect())
}

#[tauri::command]
pub fn create_worktree(
    state: State<ProjectManager>,
    project_id: String,
    branch: String,
    base: Option<String>,
) -> Result<WorktreeDto, String> {
    let repo_path = state
        .get_repo_path(&project_id)?
        .ok_or("project has no repo_path")?;
    let path = crate::git::worktree_add(&repo_path, &branch, base.as_deref())?;
    let id = format!("worktree-{}", uuid_like());
    state.insert_worktree(&id, &project_id, &path, &branch)?;
    Ok(WorktreeDto { id, project_id, path, branch })
}

#[tauri::command]
pub fn remove_worktree(state: State<ProjectManager>, id: String, project_id: String, path: String, force: bool) -> Result<(), String> {
    let repo_path = state
        .get_repo_path(&project_id)?
        .ok_or("project has no repo_path")?;
    crate::git::worktree_remove(&repo_path, &path, force)?;
    state.delete_worktree(&id)
}

fn uuid_like() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{ts:x}")
}
