import { startTransition, useEffect, useMemo, useState } from "react";
import {
  deleteJobHistory,
  listSourceFiles,
  loadSettings,
  openPath,
  quitApp,
  readFileBase64,
  runBatch,
  saveGeneratedArtifacts,
  saveSettings
} from "../lib/api";
import { buildMarkdownReport } from "../lib/markdown";
import { buildPdfBase64 } from "../lib/pdf";
import { AppSettings, BatchRunResult, SourceFileItem } from "../types/models";

const defaultSettings: AppSettings = {
  sourceFolder: "D:\\HPCodes\\content_summary_analyzer\\data\\source-files",
  archiveFolder: "D:\\HPCodes\\content_summary_analyzer\\data\\archive",
  categoriesText: "경제, 바이브코딩, 기타",
  geminiModel: "gemini-2.5-flash-lite",
  pollIntervalMs: 3000,
  autoRunEnabled: false
};

export function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sessionApiKey, setSessionApiKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("프로그램을 준비하고 있습니다.");
  const [sourceFiles, setSourceFiles] = useState<SourceFileItem[]>([]);
  const [runningBatch, setRunningBatch] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [runSummary, setRunSummary] = useState<BatchRunResult | null>(null);

  const categories = useMemo(
    () => parseCategories(settings.categoriesText),
    [settings.categoriesText]
  );

  const counts = useMemo(() => {
    return sourceFiles.reduce(
      (acc, file) => {
        acc.total += 1;
        if (file.status === "new") acc.new += 1;
        if (file.status === "processing") acc.processing += 1;
        if (file.status === "processed") acc.processed += 1;
        if (file.status === "failed") acc.failed += 1;
        return acc;
      },
      { total: 0, new: 0, processing: 0, processed: 0, failed: 0 }
    );
  }, [sourceFiles]);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const loaded = await loadSettings();
      setSettings(loaded);
      await refreshSourceFiles(loaded.sourceFolder);
      setStatusMessage("준비 완료. 파일 하나를 변환하거나 폴더 전체를 변환하세요.");
    } catch (error) {
      console.error(error);
      setStatusMessage("설정을 불러오지 못했습니다. Tauri 앱으로 실행 중인지 확인하세요.");
    }
  }

  async function refreshSourceFiles(folderPath = settings.sourceFolder) {
    if (!folderPath.trim()) {
      setSourceFiles([]);
      return [];
    }

    const files = await listSourceFiles(folderPath);
    startTransition(() => {
      setSourceFiles(files);
    });
    return files;
  }

  async function handleRunAll() {
    await runFiles([]);
  }

  async function handleRunSingle(file: SourceFileItem) {
    await runFiles([file.path]);
  }

  async function runFiles(selectedFilePaths: string[]) {
    if (!settings.sourceFolder.trim()) {
      setStatusMessage("원본 폴더 경로가 비어 있습니다.");
      return;
    }

    if (categories.length === 0) {
      setStatusMessage("카테고리가 비어 있습니다. 고급 설정에서 카테고리를 입력하세요.");
      return;
    }

    try {
      setRunningBatch(true);
      setActiveFilePath(selectedFilePaths[0] ?? null);
      setStatusMessage(
        selectedFilePaths.length === 1
          ? "선택한 파일을 변환하고 있습니다."
          : "폴더 안의 파일을 변환하고 있습니다."
      );

      const saved = await saveSettings(settings);
      setSettings(saved);

      const result = await runBatch(
        saved.sourceFolder,
        categories,
        saved.geminiModel,
        sessionApiKey,
        selectedFilePaths
      );

      for (const job of result.processedJobs) {
        if (!job.analysis) {
          continue;
        }

        const markdown = buildMarkdownReport(job, job.analysis);
        const sourceFileBase64 = await readFileBase64(job.sourcePdfPath);
        const pdfBase64 = await buildPdfBase64(job, job.analysis, sourceFileBase64);
        await saveGeneratedArtifacts(job.id, markdown, pdfBase64);
      }

      setRunSummary(result);
      await refreshSourceFiles(saved.sourceFolder);
      setStatusMessage(
        `완료: 변환 ${result.processedCount}개, 건너뜀 ${result.skippedCount}개, 실패 ${result.failedCount}개`
      );
    } catch (error) {
      console.error(error);
      setStatusMessage("변환 중 오류가 발생했습니다. 파일 행의 상태와 콘솔 로그를 확인하세요.");
    } finally {
      setRunningBatch(false);
      setActiveFilePath(null);
    }
  }

  async function handleDeleteHistory(file: SourceFileItem) {
    if (!file.jobId) {
      setStatusMessage("삭제할 변환 이력이 없습니다.");
      return;
    }

    const confirmed = window.confirm(
      "이 파일의 변환 이력을 삭제할까요?\n삭제 후 다시 변환할 수 있습니다. 기존 결과 파일은 삭제하지 않습니다."
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteJobHistory(file.jobId);
      await refreshSourceFiles();
      setStatusMessage(`${file.fileName} 변환 이력을 삭제했습니다. 다시 변환할 수 있습니다.`);
    } catch (error) {
      console.error(error);
      setStatusMessage("변환 이력을 삭제하지 못했습니다.");
    }
  }

  async function handleQuitApp() {
    const confirmed = runningBatch
      ? window.confirm("변환이 진행 중입니다. 그래도 프로그램을 종료할까요?")
      : window.confirm("프로그램을 종료할까요?");

    if (!confirmed) {
      return;
    }

    await quitApp();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Content Summary Analyzer</p>
          <h1>글 요약 분석기</h1>
          <p className="intro">
            원본 폴더에 파일을 넣고, API key를 입력한 뒤 하나씩 변환하거나 폴더 전체를
            변환합니다.
          </p>
        </div>
        <div className="topbar-actions">
          <div className="mode-chip">{sessionApiKey.trim() ? "Gemini 실제 분석" : "데모 모드"}</div>
          <button className="danger" onClick={() => void handleQuitApp()}>
            프로그램 종료
          </button>
        </div>
      </header>

      <section className="control-strip" aria-label="실행 설정">
        <label className="api-field">
          <span>Gemini API Key</span>
          <input
            type="password"
            value={sessionApiKey}
            onChange={(event) => setSessionApiKey(event.target.value)}
            placeholder="AIza..."
          />
          <small>비워두면 데모 결과로 변환됩니다.</small>
        </label>

        <div className="quick-actions">
          <button className="primary" onClick={() => void handleRunAll()} disabled={runningBatch}>
            {runningBatch && activeFilePath === null ? "변환 중" : "폴더 전체 변환"}
          </button>
          <button onClick={() => void refreshSourceFiles()} disabled={runningBatch}>
            새로고침
          </button>
          <button onClick={() => void openPath(settings.sourceFolder)}>원본 폴더 열기</button>
          <button onClick={() => void openPath(settings.archiveFolder)}>결과 폴더 열기</button>
        </div>
      </section>

      <section className="status-strip" aria-live="polite">
        <span>전체 {counts.total}</span>
        <span>미변환 {counts.new}</span>
        <span>변환 중 {counts.processing}</span>
        <span>완료 {counts.processed}</span>
        <span>실패 {counts.failed}</span>
      </section>

      <section className="file-workbench" aria-label="파일 목록">
        <div className="section-head">
          <div>
            <h2>파일 목록</h2>
            <p>{statusMessage}</p>
          </div>
          {runSummary ? (
            <p className="run-summary">
              마지막 실행: 변환 {runSummary.processedCount}, 건너뜀 {runSummary.skippedCount},
              실패 {runSummary.failedCount}
            </p>
          ) : null}
        </div>

        <div className="file-table" role="table" aria-label="원본 파일 변환 목록">
          <div className="file-table-head" role="row">
            <span>파일명</span>
            <span>상태</span>
            <span>카테고리</span>
            <span>작업</span>
          </div>

          {sourceFiles.map((file) => (
            <FileRow
              key={file.path}
              file={file}
              disabled={runningBatch}
              isActive={activeFilePath === file.path}
              onRun={() => void handleRunSingle(file)}
              onOpenSource={() => void openPath(file.path)}
              onOpenResult={() => void openPath(file.outputPdfPath)}
              onDeleteHistory={() => void handleDeleteHistory(file)}
            />
          ))}

          {sourceFiles.length === 0 ? (
            <div className="empty-state">
              원본 폴더에 아직 지원 파일이 없습니다. PDF, PNG, JPG, JPEG 파일을 넣고 새로고침을
              누르세요.
            </div>
          ) : null}
        </div>
      </section>

      <details className="advanced-settings">
        <summary>고급 설정</summary>
        <div className="advanced-grid">
          <label className="field">
            <span>원본 폴더</span>
            <input
              value={settings.sourceFolder}
              onChange={(event) =>
                setSettings((current) => ({ ...current, sourceFolder: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>결과 폴더</span>
            <input
              value={settings.archiveFolder}
              onChange={(event) =>
                setSettings((current) => ({ ...current, archiveFolder: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>카테고리</span>
            <input
              value={settings.categoriesText}
              onChange={(event) =>
                setSettings((current) => ({ ...current, categoriesText: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Gemini 모델</span>
            <input
              value={settings.geminiModel}
              onChange={(event) =>
                setSettings((current) => ({ ...current, geminiModel: event.target.value }))
              }
            />
          </label>
        </div>
      </details>
    </main>
  );
}

type FileRowProps = {
  file: SourceFileItem;
  disabled: boolean;
  isActive: boolean;
  onRun: () => void;
  onOpenSource: () => void;
  onOpenResult: () => void;
  onDeleteHistory: () => void;
};

function FileRow({
  file,
  disabled,
  isActive,
  onRun,
  onOpenSource,
  onOpenResult,
  onDeleteHistory
}: FileRowProps) {
  const canRun = file.status === "new" || file.status === "failed";
  const isProcessed = file.status === "processed";

  return (
    <div className={isActive ? "file-row active" : "file-row"} role="row">
      <div className="file-main">
        <strong title={file.fileName}>{file.fileName}</strong>
        <small title={file.path}>{file.path}</small>
        {file.errorMessage ? <em>{file.errorMessage}</em> : null}
      </div>
      <span className={`status-pill ${file.status}`}>{isActive ? "변환 중" : formatStatus(file.status)}</span>
      <span className="category-text">{file.category ?? "-"}</span>
      <div className="row-actions">
        {canRun ? (
          <button className="primary" onClick={onRun} disabled={disabled}>
            {file.status === "failed" ? "다시변환" : "변환"}
          </button>
        ) : null}
        {isProcessed && file.outputPdfPath ? <button onClick={onOpenResult}>결과열기</button> : null}
        <button onClick={onOpenSource}>원본열기</button>
        {file.jobId ? (
          <button className="danger" onClick={onDeleteHistory} disabled={disabled}>
            이력삭제
          </button>
        ) : null}
      </div>
    </div>
  );
}

function parseCategories(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatStatus(status: SourceFileItem["status"]) {
  switch (status) {
    case "processed":
      return "변환 완료";
    case "failed":
      return "실패";
    case "processing":
      return "변환 중";
    default:
      return "미변환";
  }
}
