import { invoke } from "@tauri-apps/api/core";
import {
  AppSettings,
  BatchRunResult,
  JobDetail,
  JobListItem,
  SourceFileItem
} from "../types/models";

export async function loadSettings() {
  return invoke<AppSettings>("load_settings");
}

export async function saveSettings(settings: AppSettings) {
  return invoke<AppSettings>("save_settings", { settings });
}

export async function listSourceFiles(folderPath: string) {
  return invoke<SourceFileItem[]>("list_source_files", { folderPath });
}

export async function createCategoryFolders(
  archiveFolder: string,
  categories: string[]
) {
  return invoke<string[]>("create_category_folders", { archiveFolder, categories });
}

export async function runBatch(
  folderPath: string,
  categories: string[],
  model: string,
  apiKey: string
) {
  return invoke<BatchRunResult>("run_batch", {
    folderPath,
    categories,
    model,
    apiKey
  });
}

export async function saveGeneratedArtifacts(
  jobId: string,
  markdown: string,
  pdfBase64: string
) {
  return invoke<JobDetail>("save_generated_artifacts", {
    jobId,
    markdown,
    pdfBase64
  });
}

export async function listJobs(query = "", category?: string) {
  return invoke<JobListItem[]>("list_jobs", { query, category });
}

export async function getJobDetail(jobId: string) {
  return invoke<JobDetail>("get_job_detail", { jobId });
}

export async function openPath(path: string | null) {
  return invoke<void>("open_path", { path: path ?? "" });
}
