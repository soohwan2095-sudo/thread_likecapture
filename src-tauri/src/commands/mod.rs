use std::{collections::HashSet, fs, path::Path, process::Command};

use base64::Engine;
use tauri::{AppHandle, State};

use crate::{
    capture::scan_source_folder,
    errors::AppError,
    gemini::analyze_path,
    models::{AnalysisResult, AppSettings, BatchRunResult, JobDetail, SourceFileItem},
    storage::Database,
};

pub struct AppState {
    pub database: Database,
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.database.load_settings().map_err(to_message)
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    state.database.save_settings(&settings).map_err(to_message)
}

#[tauri::command]
pub fn list_source_files(
    state: State<'_, AppState>,
    folder_path: String,
) -> Result<Vec<SourceFileItem>, String> {
    let scanned = scan_source_folder(&folder_path).map_err(to_message)?;
    let mut merged = Vec::with_capacity(scanned.len());

    for mut item in scanned {
        if let Some(state_item) = state
            .database
            .get_source_file_state(&item.path)
            .map_err(to_message)?
        {
            item.status = state_item.status;
            item.category = state_item.category;
            item.output_pdf_path = state_item.output_pdf_path;
            item.job_id = state_item.job_id;
            item.error_message = state_item.error_message;
        }
        merged.push(item);
    }

    Ok(merged)
}

#[tauri::command]
pub fn create_category_folders(
    state: State<'_, AppState>,
    archive_folder: String,
    categories: Vec<String>,
) -> Result<Vec<String>, String> {
    state
        .database
        .create_category_folders(&archive_folder, &normalize_categories(&categories))
        .map_err(to_message)
}

#[tauri::command]
pub async fn run_batch(
    state: State<'_, AppState>,
    folder_path: String,
    categories: Vec<String>,
    model: String,
    api_key: String,
    selected_file_paths: Vec<String>,
) -> Result<BatchRunResult, String> {
    let normalized_categories = normalize_categories(&categories);
    let selected_paths = selected_file_paths
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .collect::<HashSet<_>>();
    let files = scan_source_folder(&folder_path)
        .map_err(to_message)?
        .into_iter()
        .filter(|file| selected_paths.is_empty() || selected_paths.contains(&file.path))
        .collect::<Vec<_>>();

    let mut processed_jobs = Vec::new();
    let mut skipped_count = 0usize;
    let mut failed_count = 0usize;

    for file in files {
        if state
            .database
            .get_source_file_state(&file.path)
            .map_err(to_message)?
            .and_then(|item| item.output_pdf_path)
            .is_some_and(|path| Path::new(&path).exists())
        {
            skipped_count += 1;
            continue;
        }

        let created = state
            .database
            .create_job_from_source_file(&file.path)
            .map_err(to_message)?;

        state
            .database
            .mark_job_status(&created.id, "analyzing", None)
            .map_err(to_message)?;

        let analysis_result = if api_key.trim().is_empty() {
            Ok(build_demo_analysis(&created, &normalized_categories))
        } else {
            analyze_path(
                api_key.trim(),
                &model,
                std::path::Path::new(&created.source_pdf_path),
                &normalized_categories,
            )
            .await
        };

        match analysis_result {
            Ok(analysis) => {
                state
                    .database
                    .store_analysis(&created.id, &analysis)
                    .map_err(to_message)?;
                let detail = state.database.get_job_detail(&created.id).map_err(to_message)?;
                processed_jobs.push(detail);
            }
            Err(error) => {
                failed_count += 1;
                let message = error.to_string();
                state
                    .database
                    .mark_job_status(&created.id, "failed", Some(&message))
                    .map_err(to_message)?;
            }
        }
    }

    Ok(BatchRunResult {
        processed_count: processed_jobs.len(),
        skipped_count,
        failed_count,
        processed_jobs,
    })
}

#[tauri::command]
pub fn save_generated_artifacts(
    state: State<'_, AppState>,
    job_id: String,
    markdown: String,
    pdf_base64: String,
) -> Result<JobDetail, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(pdf_base64)
        .map_err(|error| error.to_string())?;
    state
        .database
        .save_generated_artifacts(&job_id, &markdown, &bytes)
        .map_err(to_message)
}

#[tauri::command]
pub fn read_file_base64(path: String) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn list_jobs(
    state: State<'_, AppState>,
    query: String,
    category: Option<String>,
) -> Result<Vec<crate::models::JobListItem>, String> {
    state
        .database
        .list_jobs(&query, category.as_deref())
        .map_err(to_message)
}

#[tauri::command]
pub fn get_job_detail(
    state: State<'_, AppState>,
    job_id: String,
) -> Result<JobDetail, String> {
    state.database.get_job_detail(&job_id).map_err(to_message)
}

#[tauri::command]
pub fn delete_job_history(state: State<'_, AppState>, job_id: String) -> Result<(), String> {
    state.database.delete_job_history(&job_id).map_err(to_message)
}

#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Ok(());
    }

    Command::new("cmd")
        .args(["/C", "start", "", &path])
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn to_message(error: AppError) -> String {
    error.to_string()
}

fn normalize_categories(categories: &[String]) -> Vec<String> {
    let mut normalized = categories
        .iter()
        .flat_map(|line| line.split(','))
        .map(|item| item.trim())
        .filter(|item| !item.is_empty())
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        normalized = vec![
            "\u{ACBD}\u{C81C}".to_string(),
            "\u{BC14}\u{C774}\u{BE0C}\u{CF54}\u{B529}".to_string(),
            "\u{AE30}\u{D0C0}".to_string(),
        ];
    }

    normalized
}

fn build_demo_analysis(job: &JobDetail, categories: &[String]) -> AnalysisResult {
    let fallback = categories
        .last()
        .cloned()
        .unwrap_or_else(|| "Unsorted".to_string());
    let title = if job.title.trim().is_empty() {
        "Demo analysis result".to_string()
    } else {
        format!("{} (Demo)", job.title)
    };

    let lowered_file = job.raw_file_name.to_lowercase();
    let category = categories
        .iter()
        .find(|category| {
            let lowered_category = category.to_lowercase();
            lowered_file.contains(&lowered_category)
                || (lowered_category.contains("경제")
                    && ["stock", "market", "rates", "macro"].iter().any(|key| lowered_file.contains(key)))
                || (lowered_category.contains("바이브")
                    && ["ai", "code", "coding", "prompt", "vibe"].iter().any(|key| lowered_file.contains(key)))
        })
        .cloned()
        .unwrap_or(fallback);

    AnalysisResult {
        title,
        category: category.clone(),
        one_line_summary: format!(
            "Gemini API key is empty, so this file was processed in demo mode and routed to '{}'.",
            category
        ),
        detailed_explanation: "Demo mode does not read the actual file contents. It exists to verify the local workflow safely: source folder scan, skip logic, category routing, result PDF creation, and archive output. Enter a Gemini API key only in the on-screen security card when you want real file analysis.".to_string(),
        key_points: vec![
            "The source folder scan and batch loop are working.".to_string(),
            "Already processed files are skipped on the next run.".to_string(),
            "Category folders can be created and used as output targets.".to_string(),
        ],
        insights: vec![
            "You can validate the full local workflow before spending API quota.".to_string(),
            "Real summaries and explanations appear only after a live Gemini run.".to_string(),
        ],
        uncertainty_notes: vec![
            "Demo mode does not inspect the actual PDF or image body.".to_string(),
            "Category selection is inferred from the filename only.".to_string(),
        ],
    }
}
