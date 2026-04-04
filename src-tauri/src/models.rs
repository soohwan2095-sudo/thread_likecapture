use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub source_folder: String,
    pub archive_folder: String,
    pub categories_text: String,
    pub gemini_model: String,
    pub poll_interval_ms: i64,
    pub auto_run_enabled: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            source_folder: String::new(),
            archive_folder: String::new(),
            categories_text: "\u{ACBD}\u{C81C}, \u{BC14}\u{C774}\u{BE0C}\u{CF54}\u{B529}, \u{AE30}\u{D0C0}".to_string(),
            gemini_model: "gemini-2.5-flash-lite".to_string(),
            poll_interval_ms: 3000,
            auto_run_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceFileItem {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub status: String,
    pub category: Option<String>,
    pub output_pdf_path: Option<String>,
    pub job_id: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub title: String,
    pub category: String,
    pub one_line_summary: String,
    pub detailed_explanation: String,
    pub key_points: Vec<String>,
    pub insights: Vec<String>,
    pub uncertainty_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobListItem {
    pub id: String,
    pub title: String,
    pub status: String,
    pub category: Option<String>,
    pub source_group: String,
    pub created_at: String,
    pub updated_at: String,
    pub one_line_summary: String,
    pub source_pdf_path: String,
    pub output_pdf_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobDetail {
    pub id: String,
    pub title: String,
    pub status: String,
    pub category: Option<String>,
    pub source_group: String,
    pub created_at: String,
    pub updated_at: String,
    pub one_line_summary: String,
    pub source_pdf_path: String,
    pub output_pdf_path: Option<String>,
    pub note: String,
    pub source_group_path: String,
    pub raw_file_name: String,
    pub markdown_path: Option<String>,
    pub meta_path: Option<String>,
    pub error_message: Option<String>,
    pub analysis: Option<AnalysisResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRunResult {
    pub processed_jobs: Vec<JobDetail>,
    pub processed_count: usize,
    pub skipped_count: usize,
    pub failed_count: usize,
}
