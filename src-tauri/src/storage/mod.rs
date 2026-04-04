use std::{
    fs,
    path::{Path, PathBuf},
};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::{
    errors::AppError,
    models::{AnalysisResult, AppSettings, JobDetail, JobListItem, SourceFileItem},
};

const ROOT_LABEL: &str = "\u{B8E8}\u{D2B8}";

#[derive(Clone)]
pub struct Database {
    pub root_dir: PathBuf,
    pub db_path: PathBuf,
}

impl Database {
    pub fn new(root_dir: PathBuf) -> Result<Self, AppError> {
        let data_dir = root_dir.join("data");
        fs::create_dir_all(data_dir.join("archive"))?;
        Ok(Self {
            root_dir,
            db_path: data_dir.join("thread_likecapture.db"),
        })
    }

    pub fn init(&self) -> Result<(), AppError> {
        self.ensure_archive_dirs(&self.default_archive_root())?;
        let connection = self.connection()?;
        connection.execute_batch(
            &format!(
                r#"
                CREATE TABLE IF NOT EXISTS settings (
                  key TEXT PRIMARY KEY,
                  value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  status TEXT NOT NULL,
                  category TEXT,
                  source_group TEXT NOT NULL DEFAULT '{root_label}',
                  source_group_path TEXT NOT NULL DEFAULT '',
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  one_line_summary TEXT NOT NULL DEFAULT '',
                  source_pdf_path TEXT NOT NULL UNIQUE,
                  raw_file_name TEXT NOT NULL,
                  note TEXT NOT NULL DEFAULT '',
                  output_pdf_path TEXT,
                  markdown_path TEXT,
                  meta_path TEXT,
                  analysis_json TEXT,
                  error_message TEXT
                );
                "#,
                root_label = ROOT_LABEL
            ),
        )?;

        let _ = connection.execute(
            &format!(
                "ALTER TABLE jobs ADD COLUMN source_group TEXT NOT NULL DEFAULT '{}'",
                ROOT_LABEL
            ),
            [],
        );
        let _ = connection.execute(
            "ALTER TABLE jobs ADD COLUMN source_group_path TEXT NOT NULL DEFAULT ''",
            [],
        );
        Ok(())
    }

    pub fn load_settings(&self) -> Result<AppSettings, AppError> {
        let connection = self.connection()?;
        let mut settings = AppSettings::default();
        settings.archive_folder = self.default_archive_root().to_string_lossy().to_string();
        settings.source_folder = self
            .root_dir
            .join("data")
            .join("source-files")
            .to_string_lossy()
            .to_string();

        let mut stmt = connection.prepare("SELECT key, value FROM settings")?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            match key.as_str() {
                "source_folder" | "raw_folder" => settings.source_folder = value,
                "archive_folder" => settings.archive_folder = value,
                "categories_text" => settings.categories_text = value,
                "gemini_model" | "openai_model" => settings.gemini_model = value,
                "poll_interval_ms" => settings.poll_interval_ms = value.parse().unwrap_or(3000),
                "auto_run_enabled" => settings.auto_run_enabled = value == "true",
                _ => {}
            }
        }

        if settings.gemini_model == AppSettings::default().gemini_model {
            if let Ok(value) = std::env::var("GEMINI_MODEL") {
                settings.gemini_model = value;
            }
        }

        fs::create_dir_all(&settings.source_folder)?;
        self.ensure_archive_dirs(Path::new(&settings.archive_folder))?;
        Ok(settings)
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<AppSettings, AppError> {
        self.ensure_archive_dirs(Path::new(&settings.archive_folder))?;
        if !settings.source_folder.trim().is_empty() {
            fs::create_dir_all(&settings.source_folder)?;
        }

        let connection = self.connection()?;
        let pairs = [
            ("source_folder", settings.source_folder.clone()),
            ("archive_folder", settings.archive_folder.clone()),
            ("categories_text", settings.categories_text.clone()),
            ("gemini_model", settings.gemini_model.clone()),
            ("poll_interval_ms", settings.poll_interval_ms.to_string()),
            ("auto_run_enabled", settings.auto_run_enabled.to_string()),
        ];

        for (key, value) in pairs {
            connection.execute(
                "INSERT INTO settings(key, value) VALUES(?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![key, value],
            )?;
        }

        self.load_settings()
    }

    pub fn create_job_from_source_file(&self, file_path: &str) -> Result<JobDetail, AppError> {
        if let Some(existing_id) = self.find_job_id_by_source_path(file_path)? {
            return self.get_job_detail(&existing_id);
        }

        let path = PathBuf::from(file_path);
        let file_name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("input")
            .to_string();
        let title = strip_extension(&file_name);
        let source_group_path = path
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .to_string_lossy()
            .to_string();
        let source_root = PathBuf::from(self.load_settings()?.source_folder);
        let source_group = source_group_name(&source_root, &path);
        let job_id = Uuid::new_v4().to_string();
        let timestamp = now_iso();

        let connection = self.connection()?;
        connection.execute(
            "INSERT INTO jobs(id, title, status, source_group, source_group_path, created_at, updated_at, source_pdf_path, raw_file_name)
             VALUES(?1, ?2, 'pending', ?3, ?4, ?5, ?5, ?6, ?7)",
            params![
                job_id,
                title,
                source_group,
                source_group_path,
                timestamp,
                file_path,
                file_name
            ],
        )?;

        self.get_job_detail(&job_id)
    }

    pub fn mark_job_status(
        &self,
        job_id: &str,
        status: &str,
        error_message: Option<&str>,
    ) -> Result<(), AppError> {
        let connection = self.connection()?;
        connection.execute(
            "UPDATE jobs SET status = ?2, error_message = ?3, updated_at = ?4 WHERE id = ?1",
            params![job_id, status, error_message, now_iso()],
        )?;
        Ok(())
    }

    pub fn store_analysis(&self, job_id: &str, analysis: &AnalysisResult) -> Result<(), AppError> {
        let connection = self.connection()?;
        connection.execute(
            "UPDATE jobs
             SET title = ?2, category = ?3, one_line_summary = ?4, analysis_json = ?5, status = 'completed', updated_at = ?6, error_message = NULL
             WHERE id = ?1",
            params![
                job_id,
                analysis.title,
                analysis.category,
                analysis.one_line_summary,
                serde_json::to_string(analysis)?,
                now_iso()
            ],
        )?;
        Ok(())
    }

    pub fn save_generated_artifacts(
        &self,
        job_id: &str,
        markdown: &str,
        pdf_bytes: &[u8],
    ) -> Result<JobDetail, AppError> {
        let job = self.get_job_detail(job_id)?;
        let category = sanitize_category_folder(job.category.as_deref().unwrap_or("Unsorted"));

        let archive_root = PathBuf::from(self.load_settings()?.archive_folder);
        self.ensure_archive_dirs(&archive_root)?;
        fs::create_dir_all(archive_root.join(&category))?;

        let base_name = format!(
            "{}_{}",
            Utc::now().format("%Y-%m-%d_%H-%M-%S"),
            slugify(&job.title)
        );
        let markdown_path = archive_root.join("meta").join(format!("{}.md", base_name));
        let meta_path = archive_root.join("meta").join(format!("{}.json", base_name));
        let output_pdf_path = archive_root.join(&category).join(format!("{}.pdf", base_name));

        fs::write(&markdown_path, markdown)?;
        fs::write(&output_pdf_path, pdf_bytes)?;

        let connection = self.connection()?;
        connection.execute(
            "UPDATE jobs
             SET markdown_path = ?2, meta_path = ?3, output_pdf_path = ?4, updated_at = ?5
             WHERE id = ?1",
            params![
                job_id,
                markdown_path.to_string_lossy().to_string(),
                meta_path.to_string_lossy().to_string(),
                output_pdf_path.to_string_lossy().to_string(),
                now_iso()
            ],
        )?;

        let latest = self.get_job_detail(job_id)?;
        fs::write(meta_path, serde_json::to_string_pretty(&latest)?)?;
        Ok(latest)
    }

    pub fn list_jobs(
        &self,
        query: &str,
        category: Option<&str>,
    ) -> Result<Vec<JobListItem>, AppError> {
        let connection = self.connection()?;
        let like_query = format!("%{}%", query);

        let rows: Vec<JobListItem> = if let Some(category) = category {
            let mut stmt = connection.prepare(
                "SELECT id, title, status, category, created_at, updated_at, one_line_summary, source_pdf_path, output_pdf_path, source_group
                 FROM jobs
                 WHERE (title LIKE ?1 OR one_line_summary LIKE ?1 OR category LIKE ?1) AND category = ?2
                 ORDER BY created_at DESC",
            )?;
            let mapped = stmt.query_map(params![like_query, category], map_job_list_item)?;
            mapped.filter_map(Result::ok).collect()
        } else {
            let mut stmt = connection.prepare(
                "SELECT id, title, status, category, created_at, updated_at, one_line_summary, source_pdf_path, output_pdf_path, source_group
                 FROM jobs
                 WHERE title LIKE ?1 OR one_line_summary LIKE ?1 OR category LIKE ?1
                 ORDER BY created_at DESC",
            )?;
            let mapped = stmt.query_map(params![like_query], map_job_list_item)?;
            mapped.filter_map(Result::ok).collect()
        };

        Ok(rows)
    }

    pub fn get_job_detail(&self, job_id: &str) -> Result<JobDetail, AppError> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, title, status, category, source_group, created_at, updated_at, one_line_summary, source_pdf_path, output_pdf_path, note, source_group_path, raw_file_name, markdown_path, meta_path, error_message, analysis_json
                 FROM jobs WHERE id = ?1",
                [job_id],
                |row| {
                    let analysis_json: Option<String> = row.get(16)?;
                    Ok(JobDetail {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        status: row.get(2)?,
                        category: row.get(3)?,
                        source_group: row.get(4)?,
                        created_at: row.get(5)?,
                        updated_at: row.get(6)?,
                        one_line_summary: row.get(7)?,
                        source_pdf_path: row.get(8)?,
                        output_pdf_path: row.get(9)?,
                        note: row.get(10)?,
                        source_group_path: row.get(11)?,
                        raw_file_name: row.get(12)?,
                        markdown_path: row.get(13)?,
                        meta_path: row.get(14)?,
                        error_message: row.get(15)?,
                        analysis: analysis_json
                            .and_then(|value| serde_json::from_str::<AnalysisResult>(&value).ok()),
                    })
                },
            )
            .optional()?
            .ok_or_else(|| AppError::message("Job not found."))
    }

    pub fn get_source_file_state(&self, file_path: &str) -> Result<Option<SourceFileItem>, AppError> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, raw_file_name, created_at, status, category, output_pdf_path, error_message
                 FROM jobs WHERE source_pdf_path = ?1",
                [file_path],
                |row| {
                    Ok(SourceFileItem {
                        id: row.get::<_, String>(0)?,
                        file_name: row.get::<_, String>(1)?,
                        created_at: row.get::<_, String>(2)?,
                        status: map_source_status(&row.get::<_, String>(3)?),
                        category: row.get(4)?,
                        output_pdf_path: row.get(5)?,
                        error_message: row.get(6)?,
                        path: file_path.to_string(),
                        size_bytes: 0,
                        job_id: Some(row.get::<_, String>(0)?),
                    })
                },
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn create_category_folders(
        &self,
        archive_root: &str,
        categories: &[String],
    ) -> Result<Vec<String>, AppError> {
        let root = PathBuf::from(archive_root);
        self.ensure_archive_dirs(&root)?;
        let mut created = Vec::new();

        for category in categories {
            let folder = sanitize_category_folder(category);
            if folder.is_empty() {
                continue;
            }
            fs::create_dir_all(root.join(&folder))?;
            created.push(folder);
        }

        Ok(created)
    }

    fn find_job_id_by_source_path(&self, file_path: &str) -> Result<Option<String>, AppError> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id FROM jobs WHERE source_pdf_path = ?1",
                [file_path],
                |row| row.get(0),
            )
            .optional()
            .map_err(AppError::from)
    }

    fn ensure_archive_dirs(&self, archive_root: &Path) -> Result<(), AppError> {
        fs::create_dir_all(archive_root)?;
        fs::create_dir_all(archive_root.join("meta"))?;
        Ok(())
    }

    fn default_archive_root(&self) -> PathBuf {
        self.root_dir.join("data").join("archive")
    }

    fn connection(&self) -> Result<Connection, AppError> {
        Ok(Connection::open(&self.db_path)?)
    }
}

fn map_job_list_item(row: &rusqlite::Row<'_>) -> Result<JobListItem, rusqlite::Error> {
    Ok(JobListItem {
        id: row.get(0)?,
        title: row.get(1)?,
        status: row.get(2)?,
        category: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
        one_line_summary: row.get(6)?,
        source_pdf_path: row.get(7)?,
        output_pdf_path: row.get(8)?,
        source_group: row.get(9)?,
    })
}

fn map_source_status(status: &str) -> String {
    match status {
        "completed" => "processed".to_string(),
        "failed" => "failed".to_string(),
        "analyzing" => "processing".to_string(),
        _ => "processed".to_string(),
    }
}

fn sanitize_category_folder(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    trimmed
        .chars()
        .map(|character| {
            if matches!(character, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*') {
                '_'
            } else {
                character
            }
        })
        .collect::<String>()
}

fn slugify(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character.to_ascii_lowercase()
            } else if character.is_whitespace() || character == '-' || character == '_' {
                '-'
            } else {
                '-'
            }
        })
        .collect::<String>();
    let trimmed = cleaned.trim_matches('-').to_string();
    if trimmed.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        trimmed
    }
}

fn strip_extension(value: &str) -> String {
    Path::new(value)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(value)
        .to_string()
}

fn source_group_name(source_root: &Path, file_path: &Path) -> String {
    let parent = match file_path.parent() {
        Some(value) => value,
        None => return ROOT_LABEL.to_string(),
    };

    if parent == source_root {
        return ROOT_LABEL.to_string();
    }

    parent
        .file_name()
        .and_then(|name| name.to_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| ROOT_LABEL.to_string())
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}
