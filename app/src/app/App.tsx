import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  createCategoryFolders,
  getJobDetail,
  listJobs,
  listSourceFiles,
  loadSettings,
  openPath,
  runBatch,
  saveGeneratedArtifacts,
  saveSettings
} from "../lib/api";
import { buildMarkdownReport } from "../lib/markdown";
import { buildPdfBase64 } from "../lib/pdf";
import {
  AppSettings,
  BatchRunResult,
  JobDetail,
  JobListItem,
  SourceFileItem
} from "../types/models";

const defaultSettings: AppSettings = {
  sourceFolder: "D:\\HPCodes\\thread_likecapture\\data\\source-files",
  archiveFolder: "D:\\HPCodes\\thread_likecapture\\data\\archive",
  categoriesText: "경제, 바이브코딩, 기타",
  geminiModel: "gemini-2.5-flash-lite",
  pollIntervalMs: 3000,
  autoRunEnabled: false
};

const modelOptions = [
  {
    label: "Gemini 2.0 Free",
    model: "gemini-2.5-flash-lite",
    note: "안정형 무료 모델"
  },
  {
    label: "Gemini 3.0 Free Preview",
    model: "gemini-3.1-flash-lite-preview",
    note: "최신형 무료 프리뷰"
  }
] as const;

export function App() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [sessionApiKey, setSessionApiKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("프로그램을 준비 중입니다.");
  const [sourceFiles, setSourceFiles] = useState<SourceFileItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<JobListItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [savingSettingsState, setSavingSettingsState] = useState(false);
  const [creatingFolders, setCreatingFolders] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);
  const [runSummary, setRunSummary] = useState<BatchRunResult | null>(null);
  const autoRunLockRef = useRef(false);

  const categories = useMemo(
    () => parseCategories(settings.categoriesText),
    [settings.categoriesText]
  );
  const modelNote = useMemo(
    () =>
      modelOptions.find((option) => option.model === settings.geminiModel)?.note ??
      "사용자 지정 모델",
    [settings.geminiModel]
  );

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pollSourceFiles();
    }, Math.max(1000, settings.pollIntervalMs));

    void pollSourceFiles();
    return () => window.clearInterval(timer);
  }, [
    settings.sourceFolder,
    settings.archiveFolder,
    settings.categoriesText,
    settings.geminiModel,
    settings.pollIntervalMs,
    settings.autoRunEnabled,
    sessionApiKey,
    runningBatch
  ]);

  async function bootstrap() {
    try {
      const loaded = await loadSettings();
      setSettings(loaded);
      await Promise.all([refreshSourceFiles(loaded.sourceFolder), refreshRecentJobs()]);
      setStatusMessage("준비 완료. 원본 폴더를 확인하고 시작할 수 있습니다.");
    } catch (error) {
      console.error(error);
      setStatusMessage("설정을 불러오지 못했습니다.");
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

  async function refreshRecentJobs() {
    const jobs = await listJobs("");
    startTransition(() => {
      setRecentJobs(jobs.slice(0, 8));
    });
  }

  async function pollSourceFiles() {
    try {
      const files = await refreshSourceFiles();
      if (!settings.autoRunEnabled || runningBatch || autoRunLockRef.current) {
        return;
      }

      const hasNewFiles = files.some((file) => file.status === "new");
      if (hasNewFiles) {
        autoRunLockRef.current = true;
        setStatusMessage("새 다운로드 파일을 감지해 자동 실행을 시작합니다.");
        await handleStartBatch(true);
      }
    } catch (error) {
      console.error(error);
    } finally {
      autoRunLockRef.current = false;
    }
  }

  async function handleApplyFolders() {
    try {
      setSavingSettingsState(true);
      const saved = await saveSettings(settings);
      setSettings(saved);
      await Promise.all([refreshSourceFiles(saved.sourceFolder), refreshRecentJobs()]);
      setStatusMessage("경로와 기본 설정을 저장했습니다.");
    } finally {
      setSavingSettingsState(false);
    }
  }

  async function handleCreateCategoryFolders() {
    try {
      setCreatingFolders(true);
      const saved = await saveSettings(settings);
      setSettings(saved);
      const created = await createCategoryFolders(saved.archiveFolder, categories);

      setStatusMessage(
        created.length > 0
          ? `카테고리 폴더를 만들었습니다: ${created.join(", ")}`
          : "만들 카테고리 폴더가 없습니다."
      );
    } finally {
      setCreatingFolders(false);
    }
  }

  async function handleStartBatch(fromAutoRun = false) {
    if (!settings.sourceFolder.trim()) {
      setStatusMessage("원본 폴더 경로를 먼저 입력하세요.");
      return;
    }

    if (categories.length === 0) {
      setStatusMessage("카테고리를 하나 이상 입력하세요.");
      return;
    }

    try {
      setRunningBatch(true);
      setSelectedJob(null);

      const saved = await saveSettings(settings);
      setSettings(saved);

      const result = await runBatch(
        saved.sourceFolder,
        categories,
        saved.geminiModel,
        sessionApiKey
      );

      for (const job of result.processedJobs) {
        if (!job.analysis) {
          continue;
        }

        const markdown = buildMarkdownReport(job, job.analysis);
        const pdfBase64 = await buildPdfBase64(job, job.analysis);
        await saveGeneratedArtifacts(job.id, markdown, pdfBase64);
      }

      setRunSummary(result);
      await Promise.all([refreshSourceFiles(saved.sourceFolder), refreshRecentJobs()]);

      if (result.processedJobs.length > 0) {
        const latest = await getJobDetail(result.processedJobs[0].id);
        setSelectedJob(latest);
      }

      setStatusMessage(
        result.processedCount === 0 && result.skippedCount > 0
          ? "새로 처리할 파일이 없고, 기존 파일은 전부 스킵되었습니다."
          : `${fromAutoRun ? "자동 실행" : "작업 완료"}: 신규 ${result.processedCount}건, 스킵 ${result.skippedCount}건, 실패 ${result.failedCount}건`
      );
    } catch (error) {
      console.error(error);
      setStatusMessage("배치 실행 중 오류가 발생했습니다.");
    } finally {
      setRunningBatch(false);
    }
  }

  async function handleOpenJob(jobId: string) {
    const detail = await getJobDetail(jobId);
    setSelectedJob(detail);
  }

  return (
    <div className="app-shell">
      <section className="hero-strip">
        <div className="hero-copy">
          <p className="eyebrow">Thread LikeCapture</p>
          <h1>Thread 글 요약&분석기</h1>
          <p className="hero-text">
            쓰레드 캡처 파일을 한 폴더에 넣고 시작 버튼만 누르면, Gemini가
            요약·분석하고 카테고리별 결과 PDF로 정리합니다.
          </p>
        </div>
        <div className="hero-badge">
          <strong>현재 모델</strong>
          <span>{settings.geminiModel}</span>
          <small>{modelNote}</small>
        </div>
      </section>

      <section className="workspace">
        <div className="control-panel">
          <article className="panel section-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">01</p>
                <h2>원본 폴더</h2>
              </div>
              <div className="inline-actions">
                <button onClick={() => void openPath(settings.sourceFolder)}>폴더 열기</button>
                <button
                  className="primary"
                  onClick={() => void handleApplyFolders()}
                  disabled={savingSettingsState}
                >
                  {savingSettingsState ? "적용 중..." : "경로 적용"}
                </button>
              </div>
            </div>

            <label className="field">
              <span>원본 파일 경로</span>
              <input
                value={settings.sourceFolder}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, sourceFolder: event.target.value }))
                }
                placeholder="D:\\your-folder\\thread-captures"
              />
            </label>

            <label className="field">
              <span>결과 저장 경로</span>
              <input
                value={settings.archiveFolder}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, archiveFolder: event.target.value }))
                }
                placeholder="D:\\your-folder\\thread-archive"
              />
            </label>
          </article>

          <article className="panel section-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">02</p>
                <h2>AI 종류</h2>
              </div>
              <span className="hint-chip">{modelNote}</span>
            </div>

            <div className="model-grid">
              {modelOptions.map((option) => (
                <button
                  key={option.model}
                  className={
                    settings.geminiModel === option.model ? "model-card active" : "model-card"
                  }
                  onClick={() =>
                    setSettings((current) => ({ ...current, geminiModel: option.model }))
                  }
                >
                  <strong>{option.label}</strong>
                  <small>{option.model}</small>
                  <span>{option.note}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel section-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">03</p>
                <h2>카테고리 생성</h2>
              </div>
              <button onClick={() => void handleCreateCategoryFolders()} disabled={creatingFolders}>
                {creatingFolders ? "생성 중..." : "생성 버튼"}
              </button>
            </div>

            <label className="field">
              <span>카테고리 전체값 (쉼표 또는 줄바꿈 구분)</span>
              <textarea
                rows={4}
                value={settings.categoriesText}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    categoriesText: event.target.value
                  }))
                }
                placeholder="경제, 바이브코딩, 기타"
              />
            </label>

            <div className="tag-cloud">
              {categories.map((category) => (
                <span key={category} className="tag-pill">
                  {category}
                </span>
              ))}
            </div>
          </article>

          <article className="panel section-card security-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">보안 설정</p>
                <h2>Gemini API Key</h2>
              </div>
            </div>

            <label className="field">
              <span>세션 전용 API 키 입력</span>
              <input
                type="password"
                value={sessionApiKey}
                onChange={(event) => setSessionApiKey(event.target.value)}
                placeholder="AIza..."
              />
            </label>

            <p className="security-note">
              이 입력값은 이번 실행에서만 사용합니다. 브라우저 자동화, 구글 계정
              로그인 제어, 쿠키 수집은 하지 않습니다.
            </p>
            <p className="security-note">
              Gemini API 키는 여기에 입력하면 됩니다. 비워두면 데모 모드로만
              동작합니다.
            </p>
          </article>

          <article className="panel auto-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Auto Run</p>
                <h2>새 다운로드 파일 자동 실행</h2>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoRunEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      autoRunEnabled: event.target.checked
                    }))
                  }
                />
                <span className="slider" />
              </label>
            </div>

            <p className="security-note">
              켜두면 원본 폴더에 새 파일이 들어올 때마다 자동으로 배치 실행을
              시도합니다. 끄면 지금처럼 시작 버튼으로만 돌릴 수 있습니다.
            </p>

            <label className="field">
              <span>폴링 주기(ms)</span>
              <input
                type="number"
                min={1000}
                step={500}
                value={settings.pollIntervalMs}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    pollIntervalMs: Number(event.target.value) || 3000
                  }))
                }
              />
            </label>
          </article>

          <article className="panel action-band">
            <div>
              <p className="eyebrow">Batch Run</p>
              <h2>폴더 안의 파일을 한 번에 처리</h2>
              <p>이미 처리 기록이 있는 파일은 다음 실행에서 자동으로 스킵합니다.</p>
            </div>
            <button
              className="launch-button"
              onClick={() => void handleStartBatch()}
              disabled={runningBatch}
            >
              {runningBatch ? "분석 중..." : "시작"}
            </button>
          </article>
        </div>

        <div className="preview-panel">
          <article className="panel status-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Run Status</p>
                <h2>현재 상태</h2>
              </div>
              <button onClick={() => void refreshSourceFiles()}>파일 새로고침</button>
            </div>

            <p className="status-message">{statusMessage}</p>

            {runSummary ? (
              <div className="summary-grid">
                <div className="summary-card">
                  <strong>{runSummary.processedCount}</strong>
                  <span>신규 처리</span>
                </div>
                <div className="summary-card">
                  <strong>{runSummary.skippedCount}</strong>
                  <span>스킵</span>
                </div>
                <div className="summary-card">
                  <strong>{runSummary.failedCount}</strong>
                  <span>실패</span>
                </div>
              </div>
            ) : null}
          </article>

          <article className="panel files-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Source Files</p>
                <h2>원본 폴더 파일 목록</h2>
              </div>
              <span className="count-chip">{sourceFiles.length} files</span>
            </div>

            <div className="file-list">
              {sourceFiles.map((file) => (
                <div key={file.path} className="file-row">
                  <div>
                    <strong>{file.fileName}</strong>
                    <small>
                      {formatStatus(file.status)}
                      {file.category ? ` / ${file.category}` : ""}
                    </small>
                  </div>

                  <div className="inline-actions">
                    {file.outputPdfPath ? (
                      <button onClick={() => void openPath(file.outputPdfPath)}>
                        결과 열기
                      </button>
                    ) : null}
                    <button onClick={() => void openPath(file.path)}>원본 열기</button>
                  </div>
                </div>
              ))}

              {sourceFiles.length === 0 ? (
                <p className="empty-state">
                  원본 폴더 안에 아직 지원 파일이 없습니다.
                </p>
              ) : null}
            </div>
          </article>

          <article className="panel recent-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Recent Output</p>
                <h2>최근 결과</h2>
              </div>
            </div>

            <div className="recent-grid">
              {recentJobs.map((job) => (
                <button
                  key={job.id}
                  className="recent-card"
                  onClick={() => void handleOpenJob(job.id)}
                >
                  <strong>{job.title}</strong>
                  <small>{job.category ?? "미분류"}</small>
                  <span>{job.oneLineSummary || "요약 없음"}</span>
                </button>
              ))}

              {recentJobs.length === 0 ? (
                <p className="empty-state">아직 생성된 결과가 없습니다.</p>
              ) : null}
            </div>
          </article>

          <article className="panel detail-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Result Detail</p>
                <h2>선택한 결과</h2>
              </div>

              {selectedJob ? (
                <div className="inline-actions">
                  <button onClick={() => void openPath(selectedJob.sourcePdfPath)}>원본</button>
                  <button onClick={() => void openPath(selectedJob.outputPdfPath)}>
                    결과 PDF
                  </button>
                </div>
              ) : null}
            </div>

            {selectedJob?.analysis ? (
              <div className="detail-stack">
                <div className="detail-hero">
                  <p className="eyebrow">Category</p>
                  <h3>{selectedJob.analysis.category}</h3>
                  <p>{selectedJob.analysis.oneLineSummary}</p>
                </div>

                <div className="detail-copy">
                  <h4>상세 해설</h4>
                  <p>{selectedJob.analysis.detailedExplanation}</p>
                </div>

                <div className="detail-columns">
                  <div>
                    <h4>핵심 포인트</h4>
                    <ul>
                      {selectedJob.analysis.keyPoints.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4>인사이트</h4>
                    <ul>
                      {selectedJob.analysis.insights.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="empty-state">
                최근 결과 카드 하나를 눌러 상세 내용을 보세요.
              </p>
            )}
          </article>
        </div>
      </section>
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
      return "처리 완료";
    case "failed":
      return "실패";
    case "processing":
      return "처리 중";
    default:
      return "대기";
  }
}
