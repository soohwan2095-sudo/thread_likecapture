import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import { AnalysisResult, JobDetail } from "../types/models";

const fontUrl = new URL("../assets/malgun.ttf", import.meta.url).href;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 48;
const TOP_Y = 800;
const BOTTOM_Y = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_COLOR = rgb(0.12, 0.14, 0.18);
const META_COLOR = rgb(0.28, 0.33, 0.39);

export async function buildPdfBase64(
  job: JobDetail,
  analysis: AnalysisResult
): Promise<string> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = await fetch(fontUrl).then((response) => response.arrayBuffer());
  const regularFont = await pdf.embedFont(fontBytes);
  const titleFont = regularFont;

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = TOP_Y;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY - requiredHeight >= BOTTOM_Y) {
      return;
    }

    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = TOP_Y;
  };

  const drawParagraph = (
    text: string,
    size: number,
    font: PDFFont,
    color = BODY_COLOR
  ) => {
    const lines = wrapText(text, font, size, CONTENT_WIDTH);
    const lineHeight = Math.max(16, size + 5);
    ensureSpace(lines.length * lineHeight + 8);

    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN_X,
        y: cursorY,
        size,
        font,
        color
      });
      cursorY -= lineHeight;
    }

    cursorY -= 6;
  };

  const drawSection = (title: string, body?: string) => {
    drawParagraph(title, 15, titleFont);
    if (body && body.trim().length > 0) {
      drawParagraph(body, 11, regularFont);
    }
    cursorY -= 2;
  };

  const drawBulletSection = (title: string, items: string[]) => {
    if (items.length === 0) {
      return;
    }

    drawSection(
      title,
      items
        .filter((item) => item.trim().length > 0)
        .map((item) => `- ${item}`)
        .join("\n")
    );
  };

  drawParagraph(analysis.title, 21, titleFont);
  drawParagraph(
    `\uC6D0\uBCF8 \uD30C\uC77C: ${job.rawFileName}`,
    10,
    regularFont,
    META_COLOR
  );
  drawParagraph(
    `\uCE74\uD14C\uACE0\uB9AC: ${analysis.category}`,
    10,
    regularFont,
    META_COLOR
  );
  cursorY -= 4;

  drawSection("\uD55C\uC904 \uC694\uC57D", analysis.oneLineSummary);
  drawSection("\uC0C1\uC138 \uD574\uC124", analysis.detailedExplanation);
  drawBulletSection("\uD575\uC2EC \uD3EC\uC778\uD2B8", analysis.keyPoints);
  drawBulletSection("\uC778\uC0AC\uC774\uD2B8", analysis.insights);
  drawBulletSection("\uBD88\uD655\uC2E4\uD55C \uBD80\uBD84", analysis.uncertaintyNotes);

  const bytes = await pdf.save();
  return arrayBufferToBase64(bytes.buffer as ArrayBuffer);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const rawLines = text.split("\n");

  for (const rawLine of rawLines) {
    let currentLine = "";

    for (const char of rawLine) {
      const candidate = `${currentLine}${char}`;
      const width = font.widthOfTextAtSize(candidate, size);

      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = candidate;
      }
    }

    lines.push(currentLine || " ");
  }

  return lines;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
