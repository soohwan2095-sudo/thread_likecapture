mod capture;
mod commands;
mod errors;
mod gemini;
mod models;
mod storage;

use commands::AppState;
use storage::Database;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let root_dir = std::env::current_dir().unwrap_or_else(|_| {
                app.path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("."))
            });
            let database = Database::new(root_dir)?;
            database.init()?;
            app.manage(AppState { database });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::list_source_files,
            commands::create_category_folders,
            commands::run_batch,
            commands::save_generated_artifacts,
            commands::list_jobs,
            commands::get_job_detail,
            commands::open_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
