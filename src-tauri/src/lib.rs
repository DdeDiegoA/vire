use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .manage(process::ProcessManager::default())
    .invoke_handler(tauri::generate_handler![
      ipc::open_terminal,
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
      ipc::read_text_file,
      ipc::write_text_file,
      ipc::run_agent,
      ipc::git_status,
      ipc::git_diff,
      ipc::git_stage,
      ipc::git_unstage,
      ipc::git_commit,
    ])
    // Closing the window hides it instead of quitting — terminal sessions
    // (live PTY + vt100 thread in ProcessManager) keep running so reopening
    // the window resumes them exactly where they were left. Only the tray's
    // "Salir" does a real quit (kills every session first).
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .setup(|app| {
      app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
      app.handle().plugin(tauri_plugin_process::init())?;
      app.handle().plugin(tauri_plugin_dialog::init())?;
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

      let show_item = MenuItem::with_id(app, "show", "Mostrar Vire", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          "quit" => {
            app.state::<process::ProcessManager>().kill_all();
            app.exit(0);
          }
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
pub mod terminal;
pub mod process;
pub mod project;
pub mod ipc;
pub mod agent;
pub mod git;
