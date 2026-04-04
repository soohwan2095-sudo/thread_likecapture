use std::{
    ffi::OsStr,
    path::PathBuf,
    time::UNIX_EPOCH,
};

use chrono::{DateTime, Utc};
use uuid::Uuid;
use walkdir::WalkDir;

use crate::{errors::AppError, models::SourceFileItem};

pub fn scan_source_folder(folder_path: &str) -> Result<Vec<SourceFileItem>, AppError> {
    let path = PathBuf::from(folder_path);
    if folder_path.trim().is_empty() || !path.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    for entry in WalkDir::new(&path).max_depth(1) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };

        if !entry.file_type().is_file() || !is_supported(entry.path()) {
            continue;
        }

        let metadata = entry.metadata()?;
        let created_at = metadata
            .created()
            .or_else(|_| metadata.modified())
            .unwrap_or(UNIX_EPOCH);

        results.push(SourceFileItem {
            id: Uuid::new_v4().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            file_name: entry.file_name().to_string_lossy().to_string(),
            created_at: DateTime::<Utc>::from(created_at).to_rfc3339(),
            size_bytes: metadata.len(),
            status: "new".to_string(),
            category: None,
            output_pdf_path: None,
            job_id: None,
            error_message: None,
        });
    }

    results.sort_by(|left, right| left.created_at.cmp(&right.created_at));
    Ok(results)
}

fn is_supported(path: &std::path::Path) -> bool {
    matches!(
        path.extension()
            .and_then(OsStr::to_str)
            .map(|ext| ext.to_ascii_lowercase())
            .as_deref(),
        Some("pdf" | "png" | "jpg" | "jpeg")
    )
}
