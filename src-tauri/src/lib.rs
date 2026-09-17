mod access;
mod commands;
mod scan;
mod state;
mod tree;
mod volume;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(state::AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::start_scan,
            commands::cancel_scan,
            commands::get_view,
            commands::get_node,
            commands::trash_path,
            commands::rename_path,
            commands::disk_access_status,
            commands::open_full_disk_access_settings,
            commands::get_volume_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
