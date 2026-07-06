// ipc module - Vire backend
use crate::process::ProcessManager;
use crate::project::ProjectManager;
use tauri::{ipc::Channel, State};

#[tauri::command]
pub fn create_terminal(
    process: State<ProcessManager>,
    project: State<ProjectManager>,
    surface_id: String,
    project_id: String,
    cols: u16,
    rows: u16,
    on_frame: Channel<crate::terminal::TermFrame>,
) -> Result<(), String> {
    process.spawn(surface_id.clone(), cols, rows, move |frame| {
        let _ = on_frame.send(frame);
    })?;
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
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
}

#[tauri::command]
pub fn list_projects(state: State<ProjectManager>) -> Result<Vec<ProjectDto>, String> {
    Ok(state
        .list_projects()?
        .into_iter()
        .map(|p| ProjectDto { id: p.id, name: p.name })
        .collect())
}

#[tauri::command]
pub fn upsert_project(state: State<ProjectManager>, id: String, name: String) -> Result<(), String> {
    state.upsert_project(&id, &name)
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
pub fn set_config(state: State<ProjectManager>, key: String, value_json: String) -> Result<(), String> {
    state.set_config(&key, &value_json)
}
