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
      ipc::get_terminal_scrollback,
      ipc::terminal_ports,
      ipc::list_shells,
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
      ipc::list_worktrees,
      ipc::create_worktree,
      ipc::remove_worktree,
    ])
    // Closing the window hides it instead of quitting — terminal sessions
    // (live PTY in ProcessManager) keep running so reopening
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
      app.handle().plugin(tauri_plugin_notification::init())?;
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
            let process_manager = app.state::<process::ProcessManager>();
            let project_manager = app.state::<project::ProjectManager>();
            // Before the PTYs die for real: if a terminal's foreground job is
            // a known agent CLI, remember how to --resume it. Otherwise clear
            // any stale resume from a previous quit so we don't wrongly
            // retype it into an unrelated shell session later.
            for surface_id in process_manager.live_ids() {
              let comm = process_manager.foreground_pid(&surface_id).and_then(procscan::process_name);
              let cwd = project_manager.get_terminal_cwd(&surface_id).ok().flatten();
              let resume = match (&comm, &cwd) {
                (Some(comm), Some(cwd)) => agent_resume::detect(comm, cwd),
                _ => None,
              };
              match resume {
                Some(cmd) => { let _ = project_manager.save_agent_resume(&surface_id, &cmd); }
                None => { let _ = project_manager.clear_agent_resume(&surface_id); }
              }
            }
            for (surface_id, bytes) in process_manager.snapshot_all() {
              let _ = project_manager.save_scrollback(&surface_id, &bytes);
            }
            process_manager.kill_all();
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
pub mod process;
pub mod project;
pub mod ipc;
pub mod agent;
pub mod agent_resume;
pub mod git;
pub mod procscan;
