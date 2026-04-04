export type JobStatus = "pending" | "analyzing" | "completed" | "failed";

export type AppSettings = {
  sourceFolder: string;
  archiveFolder: string;
  categoriesText: string;
  geminiModel: string;
  pollIntervalMs: number;
  autoRunEnabled: boolean;
};

export type AnalysisResult = {
  title: string;
  category: string;
  oneLineSummary: string;
  detailedExplanation: string;
  keyPoints: string[];
  insights: string[];
  uncertaintyNotes: string[];
};

export type JobListItem = {
  id: string;
  title: string;
  status: JobStatus;
  category: string | null;
  sourceGroup: string;
  createdAt: string;
  updatedAt: string;
  oneLineSummary: string;
  sourcePdfPath: string;
  outputPdfPath: string | null;
};

export type JobDetail = JobListItem & {
  note: string;
  sourceGroupPath: string;
  rawFileName: string;
  markdownPath: string | null;
  metaPath: string | null;
  errorMessage: string | null;
  analysis: AnalysisResult | null;
};

export type SourceFileItem = {
  id: string;
  path: string;
  fileName: string;
  createdAt: string;
  sizeBytes: number;
  status: "new" | "processed" | "failed" | "processing";
  category: string | null;
  outputPdfPath: string | null;
  jobId: string | null;
  errorMessage: string | null;
};

export type BatchRunResult = {
  processedJobs: JobDetail[];
  processedCount: number;
  skippedCount: number;
  failedCount: number;
};
