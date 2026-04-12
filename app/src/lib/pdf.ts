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
  analysis: AnalysisResult,
  sourceFileBase64?: string
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

  if (sourceFileBase64) {
    await appendSourceFile(pdf, sourceFileBase64, job.sourcePdfPath, regularFont);
  }

  const bytes = await pdf.save();
  return bytesToBase64(bytes);
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

async function appendSourceFile(
  pdf: PDFDocument,
  sourceFileBase64: string,
  sourcePath: string,
  regularFont: PDFFont
) {
  const sourceBytes = base64ToBytes(sourceFileBase64);
  const extension = sourcePath.split(".").pop()?.toLowerCase();

  if (extension === "pdf") {
    const sourcePdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const copiedPages = await pdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const copiedPage of copiedPages) {
      pdf.addPage(copiedPage);
    }
    return;
  }

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const image =
    extension === "png" ? await pdf.embedPng(sourceBytes) : await pdf.embedJpg(sourceBytes);
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
  const maxHeight = PAGE_HEIGHT - 110;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;

  page.drawText("\uC6D0\uBCF8 \uD30C\uC77C", {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 48,
    size: 15,
    font: regularFont,
    color: BODY_COLOR
  });
  page.drawImage(image, {
    x: (PAGE_WIDTH - width) / 2,
    y: PAGE_HEIGHT - 80 - height,
    width,
    height
  });
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
