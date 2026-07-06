// ipc module - Vire backend
use crate::process::ProcessManager;
use tauri::{ipc::Channel, State};

#[tauri::command]
pub fn create_terminal(
    state: State<ProcessManager>,
    surface_id: String,
    cols: u16,
    rows: u16,
    on_frame: Channel<crate::terminal::TermFrame>,
) -> Result<(), String> {
    state.spawn(surface_id, cols, rows, move |frame| {
        let _ = on_frame.send(frame);
    })
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
pub fn close_terminal(state: State<ProcessManager>, surface_id: String) -> Result<(), String> {
    state.close(&surface_id)
}
