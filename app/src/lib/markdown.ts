import { AnalysisResult, JobDetail } from "../types/models";

export function buildMarkdownReport(job: JobDetail, analysis: AnalysisResult): string {
  const keyPoints = analysis.keyPoints.map((point) => `- ${point}`).join("\n");
  const insights = analysis.insights.map((point) => `- ${point}`).join("\n");
  const uncertainty = analysis.uncertaintyNotes.length
    ? analysis.uncertaintyNotes.map((point) => `- ${point}`).join("\n")
    : "- None";

  return `# ${analysis.title}

- Source file: ${job.rawFileName}
- Category: ${analysis.category}
- Created at: ${job.createdAt}

## One-line Summary
${analysis.oneLineSummary}

## Detailed Explanation
${analysis.detailedExplanation}

## Key Points
${keyPoints || "- None"}

## Insights
${insights || "- None"}

## Uncertainty Notes
${uncertainty}

## User Notes
${job.note || "-"}
`;
}
