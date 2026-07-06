use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(process::ProcessManager::default())
    .invoke_handler(tauri::generate_handler![
      ipc::create_terminal,
      ipc::terminal_input,
      ipc::resize_terminal,
      ipc::close_terminal,
      ipc::list_projects,
      ipc::upsert_project,
      ipc::delete_project,
      ipc::save_board,
      ipc::load_board,
      ipc::get_config,
      ipc::set_config,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      let data_dir = app.path().app_data_dir()?;
      std::fs::create_dir_all(&data_dir)?;
      let manager = project::ProjectManager::new(data_dir.join("vire.db"))
        .expect("failed to init project db");
      app.manage(manager);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
pub mod terminal;
pub mod process;
pub mod project;
pub mod ipc;
