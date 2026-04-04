import {
  CATEGORY_ALL,
  CATEGORY_ECONOMY,
  CATEGORY_MISC,
  CATEGORY_VIBE_CODING,
  CategoryFilter,
  JobListItem
} from "../../types/models";

type ArchivePanelProps = {
  jobs: JobListItem[];
  query: string;
  category: CategoryFilter;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: CategoryFilter) => void;
  onOpen: (jobId: string) => Promise<void>;
  onOpenPdf: (path: string | null) => Promise<void>;
};

const categories: CategoryFilter[] = [
  CATEGORY_ALL,
  CATEGORY_ECONOMY,
  CATEGORY_VIBE_CODING,
  CATEGORY_MISC
];

export function ArchivePanel({
  jobs,
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onOpen,
  onOpenPdf
}: ArchivePanelProps) {
  return (
    <section className="panel stack">
      <header className="panel-header">
        <div>
          <h2>Archive</h2>
          <p>Browse processed results by category.</p>
        </div>
      </header>
      <div className="grid two">
        <label className="field">
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Title, summary"
          />
        </label>
        <label className="field">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table">
        {jobs.map((job) => (
          <article key={job.id} className="table-row">
            <div>
              <strong>{job.title}</strong>
              <p>{job.oneLineSummary || "No summary"}</p>
              <small>
                {job.createdAt} / {job.status} / {job.category ?? "Unclassified"} /{" "}
                {job.sourceGroup}
              </small>
            </div>
            <div className="actions">
              <button onClick={() => void onOpen(job.id)}>Open</button>
              <button onClick={() => void onOpenPdf(job.outputPdfPath)}>
                Result PDF
              </button>
            </div>
          </article>
        ))}
        {jobs.length === 0 ? <p className="empty">No archive items yet.</p> : null}
      </div>
    </section>
  );
}
