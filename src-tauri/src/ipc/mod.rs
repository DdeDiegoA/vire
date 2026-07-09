// ipc module - Vire backend
use crate::process::ProcessManager;
use crate::project::ProjectManager;
use tauri::{ipc::Channel, State};

// Opens a terminal: if a session for this surface_id is already running
// (e.g. reopening a project after switching away — the block unmounted but
// the PTY/vt100 thread kept running), reattaches and gets an immediate
// snapshot. Otherwise spawns a fresh shell. Frontend never has to know which.
#[tauri::command]
pub fn open_terminal(
    process: State<ProcessManager>,
    project: State<ProjectManager>,
    surface_id: String,
    project_id: String,
    cols: u16,
    rows: u16,
    on_frame: Channel<crate::terminal::TermFrame>,
) -> Result<(), String> {
    if process.exists(&surface_id) {
        return process.attach(&surface_id, move |frame| {
            let _ = on_frame.send(frame);
        });
    }
    let term = project
        .get_config("terminal:type")?
        .filter(|v| v != "auto" && !v.is_empty())
        .unwrap_or_else(|| std::env::var("TERM").unwrap_or_else(|_| "xterm-256color".into()));
    process.spawn(surface_id.clone(), cols, rows, term, move |frame| {
        let _ = on_frame.send(frame);
    })?;
    let shell = crate::process::default_shell();
    project.insert_terminal(&surface_id, &project_id, &surface_id, None, &shell)
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
