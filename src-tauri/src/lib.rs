
mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::fetch_mods_for_version,
            commands::prepare_and_launch,
            commands::get_client_dir,
        ])
        .setup(|_app| {
            // Create default client directory
            let client_dir = get_default_client_dir();
            if let Some(dir) = &client_dir {
                let _ = std::fs::create_dir_all(dir);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Nano Client");
}

fn get_default_client_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".nanoclient"))
}
