use std::{fs, path::Path};

use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE};
use serde_json::{json, Value};

use crate::{errors::AppError, models::AnalysisResult};

pub async fn analyze_path(
    api_key: &str,
    model: &str,
    input_path: &Path,
    categories: &[String],
) -> Result<AnalysisResult, AppError> {
    let client = reqwest::Client::new();
    let bytes = fs::read(input_path)?;
    let mime_type = detect_mime_type(input_path)?;
    let prompt = build_prompt(categories);

    let text = if mime_type == "application/pdf" {
        let upload_url = start_resumable_upload(
            &client,
            api_key,
            input_path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("input.pdf"),
            mime_type,
            bytes.len() as u64,
        )
        .await?;

        let upload_info = finalize_upload(&client, &upload_url, &bytes).await?;
        let file_uri = upload_info["file"]["uri"]
            .as_str()
            .ok_or_else(|| AppError::message("Gemini upload response did not include a file URI."))?
            .to_string();
        let file_name = upload_info["file"]["name"].as_str().map(ToOwned::to_owned);

        let generated =
            generate_with_uploaded_file(&client, api_key, model, &prompt, &file_uri, mime_type).await;

        if let Some(name) = file_name {
            let _ = delete_uploaded_file(&client, api_key, &name).await;
        }

        generated?
    } else {
        generate_with_inline_data(
            &client,
            api_key,
            model,
            &prompt,
            mime_type,
            &STANDARD.encode(bytes),
        )
        .await?
    };

    let normalized = extract_json_block(&text)
        .ok_or_else(|| AppError::message("Gemini response did not contain valid JSON."))?;
    let mut result = serde_json::from_str::<AnalysisResult>(&normalized)?;
    normalize_category(&mut result, categories);
    Ok(result)
}

fn build_prompt(categories: &[String]) -> String {
    let normalized = normalize_categories(categories);
    let category_list = normalized
        .iter()
        .map(|item| format!("'{}'", item))
        .collect::<Vec<_>>()
        .join(", ");
    let schema_values = normalized
        .iter()
        .map(|item| format!("\"{}\"", item))
        .collect::<Vec<_>>()
        .join("|");

    format!(
        "You are analyzing a local personal archive file. \
Return JSON only. No markdown fences, no prose outside JSON. \
Write all natural-language fields in Korean. \
The category field must be exactly one of these values: {category_list}. \
Choose the single best category from the provided list. \
Do not invent facts that are not supported by the file. \
If something is unclear, put it in uncertaintyNotes. \
JSON schema: \
{{\"title\":string,\"category\":{schema_values},\"oneLineSummary\":string,\"detailedExplanation\":string,\"keyPoints\":string[],\"insights\":string[],\"uncertaintyNotes\":string[]}}",
        category_list = category_list,
        schema_values = schema_values
    )
}

fn normalize_categories(categories: &[String]) -> Vec<String> {
    let mut normalized = categories
        .iter()
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

fn normalize_category(result: &mut AnalysisResult, categories: &[String]) {
    let allowed = normalize_categories(categories);
    if !allowed.iter().any(|item| item == &result.category) {
        result.category = allowed
            .last()
            .cloned()
            .unwrap_or_else(|| "Unsorted".to_string());
    }
}

fn detect_mime_type(input_path: &Path) -> Result<&'static str, AppError> {
    match input_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("pdf") => Ok("application/pdf"),
        Some("png") => Ok("image/png"),
        Some("jpg" | "jpeg") => Ok("image/jpeg"),
        _ => Err(AppError::message("Unsupported file format.")),
    }
}

async fn start_resumable_upload(
    client: &reqwest::Client,
    api_key: &str,
    display_name: &str,
    mime_type: &str,
    byte_len: u64,
) -> Result<String, AppError> {
    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/upload/v1beta/files?key={}",
            api_key
        ))
        .header("X-Goog-Upload-Protocol", "resumable")
        .header("X-Goog-Upload-Command", "start")
        .header("X-Goog-Upload-Header-Content-Length", byte_len.to_string())
        .header("X-Goog-Upload-Header-Content-Type", mime_type)
        .header(CONTENT_TYPE, "application/json")
        .json(&json!({
            "file": {
                "display_name": display_name
            }
        }))
        .send()
        .await?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::message(format!(
            "Gemini upload start failed: {} {}",
            status, body
        )));
    }

    response
        .headers()
        .get("x-goog-upload-url")
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::message("Gemini upload URL was missing."))
}

async fn finalize_upload(
    client: &reqwest::Client,
    upload_url: &str,
    bytes: &[u8],
) -> Result<Value, AppError> {
    let response = client
        .post(upload_url)
        .header(CONTENT_LENGTH, bytes.len().to_string())
        .header("X-Goog-Upload-Offset", "0")
        .header("X-Goog-Upload-Command", "upload, finalize")
        .body(bytes.to_vec())
        .send()
        .await?;

    let status = response.status();
    let body: Value = response.json().await?;
    if !status.is_success() {
        let message = body["error"]["message"]
            .as_str()
            .unwrap_or("Gemini file upload failed.");
        return Err(AppError::message(message));
    }

    Ok(body)
}

async fn generate_with_uploaded_file(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    prompt: &str,
    file_uri: &str,
    mime_type: &str,
) -> Result<String, AppError> {
    let body = json!({
        "contents": [{
            "parts": [
                { "text": prompt },
                {
                    "file_data": {
                        "mime_type": mime_type,
                        "file_uri": file_uri
                    }
                }
            ]
        }]
    });

    generate_content(client, api_key, model, &body).await
}

async fn generate_with_inline_data(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    prompt: &str,
    mime_type: &str,
    base64_data: &str,
) -> Result<String, AppError> {
    let body = json!({
        "contents": [{
            "parts": [
                { "text": prompt },
                {
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": base64_data
                    }
                }
            ]
        }]
    });

    generate_content(client, api_key, model, &body).await
}

async fn generate_content(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    body: &Value,
) -> Result<String, AppError> {
    let response = client
        .post(format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            model, api_key
        ))
        .header(CONTENT_TYPE, "application/json")
        .json(body)
        .send()
        .await?;

    let status = response.status();
    let body: Value = response.json().await?;
    if !status.is_success() {
        let message = body["error"]["message"]
            .as_str()
            .unwrap_or("Gemini generateContent request failed.");
        return Err(AppError::message(message));
    }

    extract_output_text(&body)
        .ok_or_else(|| AppError::message("Gemini response did not include output text."))
}

async fn delete_uploaded_file(
    client: &reqwest::Client,
    api_key: &str,
    file_name: &str,
) -> Result<(), AppError> {
    let response = client
        .delete(format!(
            "https://generativelanguage.googleapis.com/v1beta/{}?key={}",
            file_name, api_key
        ))
        .send()
        .await?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(AppError::message("Gemini uploaded file cleanup failed."))
    }
}

fn extract_output_text(value: &Value) -> Option<String> {
    value["candidates"].as_array().and_then(|candidates| {
        candidates.iter().find_map(|candidate| {
            candidate["content"]["parts"].as_array().and_then(|parts| {
                let text = parts
                    .iter()
                    .filter_map(|part| part["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n");
                if text.is_empty() {
                    None
                } else {
                    Some(text)
                }
            })
        })
    })
}

fn extract_json_block(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    Some(text[start..=end].to_string())
}
