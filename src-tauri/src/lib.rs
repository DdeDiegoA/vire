#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(process::ProcessManager::default())
    .invoke_handler(tauri::generate_handler![
      ipc::create_terminal,
      ipc::terminal_input,
      ipc::resize_terminal,
      ipc::close_terminal,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
pub mod terminal;
pub mod process;
pub mod project;
pub mod ipc;
