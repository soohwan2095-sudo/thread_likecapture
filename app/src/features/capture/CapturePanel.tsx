import { JobDetail, RawFolder, RawPdfFile } from "../../types/models";

type CapturePanelProps = {
  watchEnabled: boolean;
  folders: RawFolder[];
  selectedFolderPath: string;
  pendingFiles: RawPdfFile[];
  currentJob: JobDetail | null;
  onToggleWatch: () => void;
  onSelectFolder: (path: string) => void;
  onAnalyze: () => Promise<void>;
  onOpenPath: (path: string | null) => Promise<void>;
};

export function CapturePanel({
  watchEnabled,
  folders,
  selectedFolderPath,
  pendingFiles,
  currentJob,
  onToggleWatch,
  onSelectFolder,
  onAnalyze,
  onOpenPath
}: CapturePanelProps) {
  return (
    <section className="panel stack">
      <header className="panel-header">
        <div>
          <h2>Raw Inbox</h2>
          <p>
            Drop PDFs into a raw subfolder and the app will detect them, then
            Gemini will generate classification and a detailed explanation.
          </p>
        </div>
        <button className={watchEnabled ? "primary" : ""} onClick={onToggleWatch}>
          {watchEnabled ? "Stop Watching" : "Start Watching"}
        </button>
      </header>

      <label className="field">
        <span>Selected Raw Subfolder</span>
        <select
          value={selectedFolderPath}
          onChange={(event) => onSelectFolder(event.target.value)}
        >
          {folders.map((folder) => (
            <option key={folder.path} value={folder.path}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid two">
        <div className="card stack">
          <h3>New Raw PDFs</h3>
          {pendingFiles.length === 0 ? (
            <p className="empty">No newly detected PDF files.</p>
          ) : (
            pendingFiles.map((file) => (
              <div key={file.id} className="list-row">
                <div>
                  <strong>{file.fileName}</strong>
                  <small>{file.createdAt}</small>
                </div>
                <small>{Math.round(file.sizeBytes / 1024)} KB</small>
              </div>
            ))
          )}
        </div>

        <div className="card stack">
          <h3>Current Job</h3>
          {currentJob ? (
            <>
              <div className="list-row">
                <div>
                  <strong>{currentJob.title}</strong>
                  <small>
                    {currentJob.status} / {currentJob.sourceGroup}
                  </small>
                </div>
                <button onClick={() => void onOpenPath(currentJob.sourcePdfPath)}>
                  Source PDF
                </button>
              </div>
              <p>{currentJob.oneLineSummary || "No summary yet."}</p>
              <div className="actions">
                <button className="primary" onClick={() => void onAnalyze()}>
                  Run Gemini Analysis
                </button>
              </div>
            </>
          ) : (
            <p className="empty">
              A job will be created when PDFs appear in the selected raw
              subfolder.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
