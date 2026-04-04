import { JobDetail } from "../../types/models";

type ReportPanelProps = {
  job: JobDetail | null;
  onOpenPath: (path: string | null) => Promise<void>;
};

export function ReportPanel({ job, onOpenPath }: ReportPanelProps) {
  if (!job) {
    return (
      <section className="panel">
        <p className="empty">No report selected.</p>
      </section>
    );
  }

  return (
    <section className="panel stack">
      <header className="panel-header">
        <div>
          <h2>{job.title}</h2>
          <p>
            {job.createdAt} / {job.status} / {job.category ?? "Unclassified"} /{" "}
            {job.sourceGroup}
          </p>
        </div>
        <div className="actions">
          <button onClick={() => void onOpenPath(job.sourcePdfPath)}>Source PDF</button>
          <button onClick={() => void onOpenPath(job.markdownPath)}>Markdown</button>
          <button onClick={() => void onOpenPath(job.outputPdfPath)}>Result PDF</button>
        </div>
      </header>

      {job.analysis ? (
        <>
          <div className="hero">
            <p className="eyebrow">One-line Summary</p>
            <h3>{job.analysis.oneLineSummary}</h3>
            <p className="hero-meta">Category: {job.analysis.category}</p>
          </div>
          <article className="card stack">
            <h3>Detailed Explanation</h3>
            <p>{job.analysis.detailedExplanation}</p>
          </article>
          <div className="grid two">
            <article className="card stack">
              <h3>Key Points</h3>
              <ul>
                {job.analysis.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
            <article className="card stack">
              <h3>Insights</h3>
              <ul>
                {job.analysis.insights.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          </div>
          <article className="card stack">
            <h3>Uncertainty Notes</h3>
            {job.analysis.uncertaintyNotes.length > 0 ? (
              <ul>
                {job.analysis.uncertaintyNotes.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : (
              <p>None</p>
            )}
          </article>
        </>
      ) : (
        <p className="empty">No analysis result yet.</p>
      )}
    </section>
  );
}
