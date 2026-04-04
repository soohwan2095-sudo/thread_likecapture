import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";

const root = process.cwd();
const docsDir = path.join(root, "docs");
const fontPath = "C:\\Windows\\Fonts\\malgun.ttf";
const boldFontPath = "C:\\Windows\\Fonts\\malgunbd.ttf";
const outputPdf = path.join(docsDir, "사용방법_안내.pdf");
const outputPdfAscii = path.join(docsDir, "thread-likecapture_user-guide.pdf");

const K = {
  title: "\uC0AC\uC6A9\uBC29\uBC95 \uC548\uB0B4",
  program: "\uC4F0\uB808\uB4DC \uAE00 \uC694\uC57D&\uBD84\uC11D\uAE30",
  created: "\uBB38\uC11C \uC0DD\uC131\uC77C: 2026-04-04"
};

const sections = [
  {
    title: "\uD504\uB85C\uADF8\uB7A8 \uC815\uB9AC",
    lines: [
      "\uC774 \uD504\uB85C\uADF8\uB7A8\uC740 source-files \uD3F4\uB354\uC5D0 \uB123\uC5B4\uB454 jpg, png, pdf \uD30C\uC77C\uC744 \uC21C\uCC28 \uBD84\uC11D\uD574\uC11C Gemini\uB85C \uC694\uC57D\u00B7\uD574\uC124\u00B7\uCE74\uD14C\uACE0\uB9AC \uBD84\uB958\uB97C \uB9CC\uB4E4\uACE0 \uACB0\uACFC PDF\uB97C \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uD3F4\uB354\uB85C \uC800\uC7A5\uD558\uB294 \uAC1C\uC778\uC6A9 \uBC30\uCE58 \uB3C4\uAD6C\uC785\uB2C8\uB2E4.",
      "\uC2E4\uD589\uC740 startup.bat \uB354\uBE14\uD074\uB9AD\uC774 \uAC00\uC7A5 \uC26C\uC6B4 \uBC29\uBC95\uC785\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uAC00\uC7A5 \uBE60\uB978 \uC0AC\uC6A9 \uC21C\uC11C",
    bullets: [
      "startup.bat \uC2E4\uD589",
      "\uC6D0\uBCF8 \uD30C\uC77C\uC744 source-files \uD3F4\uB354\uC5D0 \uB123\uAE30",
      "\uD654\uBA74\uC5D0\uC11C \uC6D0\uBCF8 \uD3F4\uB354 \uACBD\uB85C \uD655\uC778",
      "Gemini 2.0 Free \uB610\uB294 Gemini 3.0 Free Preview \uC120\uD0DD",
      "\uCE74\uD14C\uACE0\uB9AC \uAC12 \uC785\uB825 \uD6C4 \uC0DD\uC131 \uBC84\uD2BC \uC2E4\uD589",
      "\uD654\uBA74 \uC624\uB978\uCABD Gemini API Key \uCE78\uC5D0 \uD544\uC694 \uC2DC \uD0A4 \uC785\uB825",
      "\uC2DC\uC791 \uBC84\uD2BC \uD074\uB9AD",
      "\uACB0\uACFC PDF\uAC00 archive \uC544\uB798 \uCE74\uD14C\uACE0\uB9AC \uD3F4\uB354\uB85C \uC800\uC7A5\uB418\uB294 \uAC83 \uD655\uC778"
    ]
  },
  {
    title: "\uD654\uBA74 \uAC01 \uC601\uC5ED \uC124\uBA85",
    bullets: [
      "\uC6D0\uBCF8 \uD3F4\uB354: \uCEA1\uCC98 \uD30C\uC77C\uC774 \uB4E4\uC5B4\uC624\uB294 \uD3F4\uB354 \uACBD\uB85C\uB97C \uC801\uB294 \uC601\uC5ED",
      "AI \uC885\uB958: \uC2E4\uC81C \uBAA8\uB378 \uB9E4\uD551\uC740 gemini-2.5-flash-lite / gemini-3.1-flash-lite-preview",
      "\uCE74\uD14C\uACE0\uB9AC \uC0DD\uC131: \uC26C\uD45C \uB610\uB294 \uC904\uBC14\uAFC8\uC73C\uB85C \uCE74\uD14C\uACE0\uB9AC\uB97C \uB123\uACE0 \uD3F4\uB354\uB97C \uB9CC\uB4DC\uB294 \uC601\uC5ED",
      "Gemini API Key: \uC138\uC158 \uC804\uC6A9 \uC785\uB825\uB780\uC774\uACE0 \uD0A4\uB97C \uC601\uAD6C \uC800\uC7A5\uD558\uC9C0 \uC54A\uB3C4\uB85D \uB9DE\uCD98 \uC601\uC5ED",
      "\uC2DC\uC791 \uBC84\uD2BC: \uD3F4\uB354 \uC548\uC758 \uC9C0\uC6D0 \uD30C\uC77C\uC744 \uD55C \uBC88\uC5D0 \uC21C\uCC28 \uCC98\uB9AC\uD558\uB294 \uBC84\uD2BC",
      "\uC6D0\uBCF8 \uD3F4\uB354 \uD30C\uC77C \uBAA9\uB85D: \uAC01 \uD30C\uC77C\uC758 \uC0C1\uD0DC, \uBD84\uB958, \uACB0\uACFC \uC5EC\uBD80\uB97C \uBCF4\uB294 \uC601\uC5ED",
      "\uCD5C\uADFC \uACB0\uACFC / \uC120\uD0DD\uD55C \uACB0\uACFC: \uBC14\uB85C \uACB0\uACFC PDF\uB97C \uC5F4\uACE0 \uC0C1\uC138 \uB0B4\uC6A9\uC744 \uBCF4\uB294 \uC601\uC5ED"
    ]
  },
  {
    title: "Gemini API Key \uB123\uB294 \uC704\uCE58",
    lines: [
      "Gemini API Key\uB294 \uD654\uBA74 \uC624\uB978\uCABD \uC911\uB2E8\uC758 '\uBCF4\uC548 \uC124\uC815' \uCE74\uB4DC \uC548\uC5D0 \uC785\uB825\uD569\uB2C8\uB2E4.",
      "\uC774 \uAC12\uC740 \uC774\uBC88 \uC2E4\uD589 \uC138\uC158\uC5D0\uC11C\uB9CC \uC4F0\uACE0, \uD574\uB2F9 \uC571\uC5D0 \uC601\uAD6C \uC800\uC7A5\uD558\uC9C0 \uC54A\uB3C4\uB85D \uB9DE\uCD94\uC5C8\uC2B5\uB2C8\uB2E4.",
      "\uD0A4\uB97C \uBE44\uC6CC\uB450\uBA74 \uB370\uBAA8 \uBAA8\uB4DC\uB85C \uB3CC\uC544\uAC11\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uC790\uB3D9 \uC2E4\uD589 \uD1A0\uAE00 \uC0AC\uC6A9\uBC95",
    bullets: [
      "\uD654\uBA74 \uC911\uC559\uC758 Auto Run \uCE74\uB4DC\uC5D0\uC11C \uC2A4\uC704\uCE58\uB97C \uCF1C\uBA74 \uC6D0\uBCF8 \uD3F4\uB354 \uAC10\uC2DC \uBAA8\uB4DC\uAC00 \uCF1C\uC9D1\uB2C8\uB2E4.",
      "\uC6D0\uBCF8 \uD3F4\uB354\uC5D0 \uC0C8 \uD30C\uC77C\uC774 \uB4E4\uC5B4\uC624\uBA74 \uD3F4\uB9C1 \uC8FC\uAE30\uB9C8\uB2E4 \uAC10\uC9C0\uD558\uACE0 \uC790\uB3D9\uC73C\uB85C \uBC30\uCE58 \uC2E4\uD589\uC744 \uC2DC\uB3C4\uD569\uB2C8\uB2E4.",
      "\uC2A4\uC704\uCE58\uB97C \uB044\uBA74 \uC218\uB3D9 '\uC2DC\uC791' \uBC84\uD2BC\uB9CC \uC4F0\uB294 \uBAA8\uB4DC\uB85C \uB3CC\uC544\uAC11\uB2C8\uB2E4.",
      "\uC790\uB3D9 \uC2E4\uD589\uC774 \uCF1C\uC788\uC5B4\uB3C4 \uC774\uBBF8 \uCC98\uB9AC \uAE30\uB85D\uC774 \uC788\uB294 \uD30C\uC77C\uC740 \uC2A4\uD0B5\uB429\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uC6D0\uBCF8 \uD3F4\uB354 \uC4F0\uB294 \uBC29\uBC95",
    code: [
      "D:\\HPCodes\\thread_likecapture\\data\\source-files",
      "\u251C\u2500 thread_001.pdf",
      "\u251C\u2500 thread_002.png",
      "\u251C\u2500 thread_003.jpg",
      "\u2514\u2500 thread_004.pdf"
    ],
    bullets: [
      "\uD06C\uB86C \uB610\uB294 GoFullPage \uB2E4\uC6B4\uB85C\uB4DC \uACBD\uB85C\uB97C source-files \uB85C \uB9DE\uCD94\uBA74 \uAC00\uC7A5 \uD3B8\uD569\uB2C8\uB2E4.",
      "\uC9C0\uC6D0 \uD615\uC2DD\uC740 pdf, png, jpg, jpeg \uC785\uB2C8\uB2E4.",
      "\uC5EC\uB7EC \uD30C\uC77C\uC774 \uC788\uC73C\uBA74 \uD30C\uC77C 1\uAC1C\uB2F9 \uACB0\uACFC 1\uAC1C\uC529 \uCC98\uB9AC\uD569\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uCE74\uD14C\uACE0\uB9AC \uC0DD\uC131 \uBC29\uC2DD",
    bullets: [
      "\uC785\uB825\uCC3D\uC5D0 '\uACBD\uC81C, \uBC14\uC774\uBE0C\uCF54\uB529, \uAE30\uD0C0' \uCC98\uB7FC \uC27C\uD45C\uB85C \uB123\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
      "\uC904\uBC14\uAFC8\uC73C\uB85C \uD55C \uC904\uC529 \uC801\uC5B4\uB3C4 \uB3D9\uC791\uD569\uB2C8\uB2E4.",
      "\uC0DD\uC131 \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 archive \uD3F4\uB354 \uC544\uB798\uC5D0 \uD574\uB2F9 \uCE74\uD14C\uACE0\uB9AC \uD3F4\uB354\uB97C \uB9CC\uB4ED\uB2C8\uB2E4.",
      "Gemini \uB610\uB294 \uD504\uB85C\uADF8\uB7A8\uC740 \uBD84\uC11D \uACB0\uACFC\uC758 category \uAC12\uC744 \uBCF4\uACE0 \uD574\uB2F9 \uD3F4\uB354\uC5D0 \uACB0\uACFC PDF\uB97C \uB123\uC2B5\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uC2DC\uC791 \uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uC5B4\uB5BB\uAC8C \uB3CC\uC544\uAC00\uB098",
    bullets: [
      "\uC6D0\uBCF8 \uD3F4\uB354\uB97C \uC2A4\uCE94\uD569\uB2C8\uB2E4.",
      "\uC9C0\uC6D0 \uD30C\uC77C\uC744 \uD558\uB098\uC529 \uC21C\uCC28 \uCC98\uB9AC\uD569\uB2C8\uB2E4.",
      "\uC774\uBBF8 \uCC98\uB9AC \uAE30\uB85D\uC774 \uB0A8\uC740 \uD30C\uC77C\uC740 \uC790\uB3D9 \uC2A4\uD0B5\uD569\uB2C8\uB2E4.",
      "\uCC98\uB9AC \uB300\uC0C1 \uD30C\uC77C\uB9CC Gemini \uBD84\uC11D \uB610\uB294 \uB370\uBAA8 \uBD84\uC11D\uC744 \uD569\uB2C8\uB2E4.",
      "\uAC01 \uD30C\uC77C\uC740 \uBD84\uC11D \uD6C4 \uACB0\uACFC PDF, Markdown, JSON \uBA54\uD0C0\uB370\uC774\uD130\uB97C \uB0A8\uAE41\uB2C8\uB2E4.",
      "\uB9C8\uC9C0\uB9C9\uC5D0 \uC2E0\uADDC \uCC98\uB9AC \uAC74\uC218, \uC2A4\uD0B5 \uAC74\uC218, \uC2E4\uD328 \uAC74\uC218\uB97C \uC694\uC57D\uD574 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uC774\uBBF8 \uB3CC\uB9B0 \uD30C\uC77C \uC2A4\uD0B5 \uADDC\uCE59",
    lines: [
      "\uD55C \uBC88 \uCC98\uB9AC\uD55C \uD30C\uC77C\uC740 \uC18C\uC2A4 \uD30C\uC77C \uACBD\uB85C \uAE30\uC900\uC73C\uB85C \uC791\uC5C5 \uAE30\uB85D\uC744 \uB0A8\uAE30\uACE0, \uB2E4\uC74C \uC2E4\uD589\uC5D0\uC11C\uB294 \uC790\uB3D9\uC73C\uB85C \uC2A4\uD0B5\uD569\uB2C8\uB2E4.",
      "\uB530\uB77C\uC11C source-files \uD3F4\uB354\uC5D0 \uADF8 \uD30C\uC77C\uC774 \uACC4\uC18D \uB0A8\uC544 \uC788\uC5B4\uB3C4 \uC911\uBCF5 \uC0DD\uC131\uB418\uC9C0 \uC54A\uB294 \uAD6C\uC870\uC785\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uACB0\uACFC \uD30C\uC77C \uC800\uC7A5 \uC704\uCE58",
    code: [
      "D:\\HPCodes\\thread_likecapture\\data\\archive",
      "\u251C\u2500 \uACBD\uC81C",
      "\u251C\u2500 \uBC14\uC774\uBE0C\uCF54\uB529",
      "\u251C\u2500 \uAE30\uD0C0",
      "\u2514\u2500 meta"
    ],
    bullets: [
      "\uCE74\uD14C\uACE0\uB9AC \uD3F4\uB354: \uBD84\uB958\uB41C \uACB0\uACFC PDF \uC800\uC7A5",
      "meta \uD3F4\uB354: Markdown\uACFC JSON \uBA54\uD0C0\uB370\uC774\uD130 \uC800\uC7A5",
      "\uC6D0\uBCF8 \uD30C\uC77C\uC740 source-files \uD3F4\uB354 \uADF8\uB300\uB85C \uB0A8\uC2B5\uB2C8\uB2E4"
    ]
  },
  {
    title: "\uBCF4\uC548 / \uAC1C\uC778\uC815\uBCF4 \uAD00\uC810 \uC815\uB9AC",
    bullets: [
      "Gemini API Key\uB294 \uD654\uBA74 \uC785\uB825 \uD6C4 \uC774\uBC88 \uC2E4\uD589\uC5D0\uC11C\uB9CC \uC0AC\uC6A9\uD558\uB3C4\uB85D \uB9DE\uCD94\uC5C8\uC2B5\uB2C8\uB2E4.",
      "\uAD6C\uAE00 \uACC4\uC815 \uB85C\uADF8\uC778\uC744 \uC790\uB3D9 \uC81C\uC5B4\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
      "\uBE0C\uB77C\uC6B0\uC800 \uC790\uB3D9\uD654, \uCFE0\uD0A4 \uC218\uC9D1, \uD06C\uB86C \uC870\uC791 \uAE30\uB2A5\uC740 \uD3EC\uD568\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
      "\uC678\uBD80\uB85C \uC804\uC1A1\uB418\uB294 \uAC83\uC740 \uB124\uAC00 \uC9C0\uC815\uD55C \uC6D0\uBCF8 \uD30C\uC77C\uACFC Gemini \uBD84\uC11D \uC694\uCCAD\uC5D0 \uD544\uC694\uD55C \uB0B4\uC6A9\uC73C\uB85C \uD55C\uC815\uB429\uB2C8\uB2E4."
    ]
  },
  {
    title: "\uBB38\uC81C \uC0DD\uAE30\uBA74 \uBA3C\uC800 \uBCFC \uAC83",
    bullets: [
      "\uC571\uC774 \uC548 \uC5F4\uB9AC\uBA74 startup.bat\uB97C \uB2E4\uC2DC \uC2E4\uD589",
      "\uC6D0\uBCF8 \uD30C\uC77C\uC774 \uBAA9\uB85D\uC5D0 \uC548 \uB728\uBA74 source-files \uACBD\uB85C\uAC00 \uB9DE\uB294\uC9C0 \uD655\uC778",
      "\uC2E4\uC81C \uB0B4\uC6A9 \uBD84\uC11D\uC774 \uC544\uB2CC \uAC83 \uAC19\uC73C\uBA74 Gemini API Key\uAC00 \uBE44\uC5B4\uC788\uB294\uC9C0 \uD655\uC778",
      "\uACB0\uACFC PDF\uAC00 \uC548 \uBCF4\uC774\uBA74 archive \uD3F4\uB354 \uC544\uB798 \uCE74\uD14C\uACE0\uB9AC \uD3F4\uB354\uB97C \uC9C1\uC811 \uD655\uC778"
    ]
  }
];

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 52;

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);

const regularFontBytes = fs.readFileSync(fontPath);
const regularFont = await pdf.embedFont(regularFontBytes);

let boldFont = regularFont;
if (fs.existsSync(boldFontPath)) {
  boldFont = await pdf.embedFont(fs.readFileSync(boldFontPath));
}

let page = pdf.addPage([pageWidth, pageHeight]);
let cursorY = pageHeight - margin;

function addPage() {
  page = pdf.addPage([pageWidth, pageHeight]);
  cursorY = pageHeight - margin;
}

function ensureSpace(heightNeeded) {
  if (cursorY - heightNeeded < margin) {
    addPage();
  }
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let buffer = "";
    for (const char of word) {
      const candidate = `${buffer}${char}`;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && buffer) {
        lines.push(buffer);
        buffer = char;
      } else {
        buffer = candidate;
      }
    }
    current = buffer;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawTextBlock(text, options = {}) {
  const {
    x = margin,
    font = regularFont,
    size = 12,
    color = rgb(0.1, 0.13, 0.17),
    maxWidth = pageWidth - margin * 2,
    lineGap = 7
  } = options;

  const lines = wrapText(text, font, size, maxWidth);
  const lineHeight = size + lineGap;
  ensureSpace(lines.length * lineHeight + 6);

  for (const line of lines) {
    page.drawText(line, { x, y: cursorY, size, font, color });
    cursorY -= lineHeight;
  }
}

function drawSpacer(height) {
  ensureSpace(height);
  cursorY -= height;
}

function drawRule() {
  ensureSpace(16);
  page.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.88)
  });
  cursorY -= 16;
}

function drawBullet(text) {
  const bulletX = margin + 4;
  const textX = margin + 18;
  const maxWidth = pageWidth - margin * 2 - 18;
  const lines = wrapText(text, regularFont, 12, maxWidth);
  const lineHeight = 19;
  ensureSpace(lines.length * lineHeight + 4);

  page.drawText("\u2022", {
    x: bulletX,
    y: cursorY,
    size: 13,
    font: boldFont,
    color: rgb(0.8, 0.36, 0.2)
  });

  for (const line of lines) {
    page.drawText(line, {
      x: textX,
      y: cursorY,
      size: 12,
      font: regularFont,
      color: rgb(0.1, 0.13, 0.17)
    });
    cursorY -= lineHeight;
  }
}

function drawCodeBlock(lines) {
  const fontSize = 11;
  const lineHeight = 17;
  const blockHeight = lines.length * lineHeight + 24;
  ensureSpace(blockHeight + 6);

  page.drawRectangle({
    x: margin,
    y: cursorY - blockHeight + 10,
    width: pageWidth - margin * 2,
    height: blockHeight,
    color: rgb(0.13, 0.16, 0.2)
  });

  let y = cursorY - 6;
  for (const line of lines) {
    page.drawText(line, {
      x: margin + 14,
      y,
      size: fontSize,
      font: regularFont,
      color: rgb(0.92, 0.95, 0.98)
    });
    y -= lineHeight;
  }

  cursorY -= blockHeight + 6;
}

page.drawRectangle({
  x: margin,
  y: cursorY - 82,
  width: pageWidth - margin * 2,
  height: 82,
  color: rgb(0.95, 0.89, 0.84)
});

drawTextBlock("Thread LikeCapture", {
  font: boldFont,
  size: 11,
  color: rgb(0.55, 0.29, 0.18)
});
drawTextBlock(K.title, {
  font: boldFont,
  size: 28,
  color: rgb(0.08, 0.1, 0.14)
});
drawTextBlock(K.program, {
  size: 13,
  color: rgb(0.28, 0.33, 0.38)
});
drawSpacer(20);

for (const section of sections) {
  drawRule();
  drawTextBlock(section.title, {
    font: boldFont,
    size: 18,
    color: rgb(0.13, 0.18, 0.22)
  });
  drawSpacer(4);

  for (const line of section.lines ?? []) {
    drawTextBlock(line);
    drawSpacer(4);
  }

  for (const bullet of section.bullets ?? []) {
    drawBullet(bullet);
  }

  if (section.code) {
    drawCodeBlock(section.code);
  }

  drawSpacer(10);
}

drawRule();
drawTextBlock(K.created, {
  size: 10,
  color: rgb(0.42, 0.47, 0.52)
});

const pdfBytes = await pdf.save();
fs.writeFileSync(outputPdf, pdfBytes);
fs.writeFileSync(outputPdfAscii, pdfBytes);

console.log(outputPdf);
