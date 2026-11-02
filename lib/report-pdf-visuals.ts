import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";

type RgbTuple = [number, number, number];

export interface VisualCard {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "critical";
}

export interface VisualBar {
  label: string;
  value: number;
  valueLabel?: string;
  color?: RgbTuple;
}

export interface VisualSegment {
  label: string;
  value: number;
  color: RgbTuple;
}

interface AddVisualSummaryPageParams {
  pdfDoc: PDFDocument;
  pageTitle: string;
  subtitle: string;
  titleFont: PDFFont;
  bodyFont: PDFFont;
  cards: VisualCard[];
  bars: VisualBar[];
  segments: VisualSegment[];
  insights: string[];
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const HEADER_HEIGHT = 56;
const LEFT_MARGIN = 32;
const RIGHT_MARGIN = 32;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      if (line) {
        lines.push(line);
      }
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

function drawWrappedText(params: {
  page: PDFPage;
  text: string;
  font: PDFFont;
  size: number;
  x: number;
  y: number;
  maxWidth: number;
  color: RgbTuple;
  lineHeight?: number;
}): number {
  const lineHeight = params.lineHeight ?? params.size + 2;
  const lines = wrapText(params.text, params.font, params.size, params.maxWidth);
  let cursor = params.y;

  for (const line of lines) {
    params.page.drawText(line, {
      x: params.x,
      y: cursor,
      size: params.size,
      font: params.font,
      color: rgb(params.color[0], params.color[1], params.color[2])
    });
    cursor -= lineHeight;
  }

  return cursor;
}

function drawPanel(params: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: RgbTuple;
  border: RgbTuple;
}) {
  params.page.drawRectangle({
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    color: rgb(params.fill[0], params.fill[1], params.fill[2]),
    borderColor: rgb(params.border[0], params.border[1], params.border[2]),
    borderWidth: 1
  });
}

function cardPalette(tone: VisualCard["tone"]): { fill: RgbTuple; border: RgbTuple; value: RgbTuple } {
  switch (tone) {
    case "good":
      return { fill: [0.05, 0.2, 0.14], border: [0.28, 0.66, 0.5], value: [0.78, 0.97, 0.89] };
    case "warning":
      return { fill: [0.24, 0.18, 0.05], border: [0.86, 0.65, 0.29], value: [0.98, 0.91, 0.73] };
    case "critical":
      return { fill: [0.24, 0.09, 0.09], border: [0.83, 0.37, 0.35], value: [0.99, 0.82, 0.82] };
    default:
      return { fill: [0.06, 0.14, 0.22], border: [0.2, 0.37, 0.52], value: [0.88, 0.96, 1] };
  }
}

export function addVisualSummaryPage(params: AddVisualSummaryPageParams) {
  const page = params.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT,
    width: PAGE_WIDTH,
    height: HEADER_HEIGHT,
    color: rgb(0.04, 0.16, 0.27)
  });
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - HEADER_HEIGHT - 4,
    width: PAGE_WIDTH,
    height: 4,
    color: rgb(0.36, 0.75, 0.88)
  });
  page.drawText(params.pageTitle, {
    x: LEFT_MARGIN,
    y: PAGE_HEIGHT - 38,
    size: 12,
    font: params.titleFont,
    color: rgb(0.92, 0.97, 1)
  });

  let y = PAGE_HEIGHT - 84;
  page.drawText("Visual Summary", {
    x: LEFT_MARGIN,
    y,
    size: 16,
    font: params.titleFont,
    color: rgb(0.08, 0.22, 0.34)
  });
  y -= 16;
  y = drawWrappedText({
    page,
    text: params.subtitle,
    font: params.bodyFont,
    size: 10,
    x: LEFT_MARGIN,
    y,
    maxWidth: CONTENT_WIDTH,
    color: [0.2, 0.24, 0.31]
  });

  y -= 8;
  const visibleCards = params.cards.slice(0, 4);
  const cardGap = 10;
  const cardHeight = 74;
  if (visibleCards.length > 0) {
    const cardWidth = (CONTENT_WIDTH - cardGap * (visibleCards.length - 1)) / visibleCards.length;
    let cardX = LEFT_MARGIN;
    for (const card of visibleCards) {
      const palette = cardPalette(card.tone);
      drawPanel({
        page,
        x: cardX,
        y: y - cardHeight,
        width: cardWidth,
        height: cardHeight,
        fill: palette.fill,
        border: palette.border
      });
      page.drawText(card.label, {
        x: cardX + 10,
        y: y - 22,
        size: 9,
        font: params.bodyFont,
        color: rgb(0.79, 0.9, 0.97)
      });
      page.drawText(card.value, {
        x: cardX + 10,
        y: y - 52,
        size: 20,
        font: params.titleFont,
        color: rgb(palette.value[0], palette.value[1], palette.value[2])
      });
      cardX += cardWidth + cardGap;
    }
    y -= cardHeight + 14;
  }

  const barsPanelHeight = 204;
  drawPanel({
    page,
    x: LEFT_MARGIN,
    y: y - barsPanelHeight,
    width: CONTENT_WIDTH,
    height: barsPanelHeight,
    fill: [0.96, 0.98, 1],
    border: [0.82, 0.88, 0.95]
  });
  page.drawText("Key Metrics", {
    x: LEFT_MARGIN + 12,
    y: y - 20,
    size: 11,
    font: params.titleFont,
    color: rgb(0.09, 0.25, 0.38)
  });

  const visibleBars = params.bars.slice(0, 6);
  const maxBarValue = Math.max(...visibleBars.map((bar) => bar.value), 1);
  const barLeft = LEFT_MARGIN + 170;
  const barWidth = CONTENT_WIDTH - 220;
  let barY = y - 44;
  for (const bar of visibleBars) {
    const fill = bar.color ?? [0.19, 0.47, 0.78];
    const scaled = bar.value > 0 ? Math.max((bar.value / maxBarValue) * barWidth, 1) : 0;
    page.drawText(bar.label, {
      x: LEFT_MARGIN + 12,
      y: barY + 3,
      size: 9,
      font: params.bodyFont,
      color: rgb(0.18, 0.24, 0.31)
    });
    page.drawRectangle({
      x: barLeft,
      y: barY,
      width: barWidth,
      height: 12,
      color: rgb(0.9, 0.94, 0.98)
    });
    if (scaled > 0) {
      page.drawRectangle({
        x: barLeft,
        y: barY,
        width: scaled,
        height: 12,
        color: rgb(fill[0], fill[1], fill[2])
      });
    }
    page.drawText(bar.valueLabel ?? `${bar.value}`, {
      x: barLeft + barWidth + 8,
      y: barY + 3,
      size: 9,
      font: params.bodyFont,
      color: rgb(0.21, 0.27, 0.35)
    });
    barY -= 26;
  }

  y -= barsPanelHeight + 12;

  const segmentPanelHeight = 88;
  drawPanel({
    page,
    x: LEFT_MARGIN,
    y: y - segmentPanelHeight,
    width: CONTENT_WIDTH,
    height: segmentPanelHeight,
    fill: [0.97, 0.98, 1],
    border: [0.82, 0.88, 0.95]
  });
  page.drawText("Status Mix", {
    x: LEFT_MARGIN + 12,
    y: y - 20,
    size: 11,
    font: params.titleFont,
    color: rgb(0.09, 0.25, 0.38)
  });

  const visibleSegments = params.segments.slice(0, 6);
  const totalSegments = visibleSegments.reduce((total, segment) => total + Math.max(segment.value, 0), 0);
  const stackX = LEFT_MARGIN + 12;
  const stackY = y - 40;
  const stackWidth = CONTENT_WIDTH - 24;
  const stackHeight = 14;
  page.drawRectangle({ x: stackX, y: stackY, width: stackWidth, height: stackHeight, color: rgb(0.9, 0.94, 0.98) });

  if (totalSegments > 0) {
    let offset = 0;
    for (const segment of visibleSegments) {
      if (segment.value <= 0) {
        continue;
      }
      const segmentWidth = (segment.value / totalSegments) * stackWidth;
      page.drawRectangle({
        x: stackX + offset,
        y: stackY,
        width: segmentWidth,
        height: stackHeight,
        color: rgb(segment.color[0], segment.color[1], segment.color[2])
      });
      offset += segmentWidth;
    }
  }

  let legendX = LEFT_MARGIN + 12;
  const legendY = y - 60;
  for (const segment of visibleSegments) {
    page.drawRectangle({
      x: legendX,
      y: legendY,
      width: 8,
      height: 8,
      color: rgb(segment.color[0], segment.color[1], segment.color[2])
    });
    const label = `${segment.label} (${segment.value})`;
    page.drawText(label, {
      x: legendX + 12,
      y: legendY,
      size: 8,
      font: params.bodyFont,
      color: rgb(0.2, 0.24, 0.31)
    });
    legendX += Math.min(120 + label.length * 1.6, 170);
    if (legendX > LEFT_MARGIN + CONTENT_WIDTH - 120) {
      break;
    }
  }

  y -= segmentPanelHeight + 12;

  const insightPanelHeight = y - 44;
  drawPanel({
    page,
    x: LEFT_MARGIN,
    y: 44,
    width: CONTENT_WIDTH,
    height: insightPanelHeight,
    fill: [0.97, 0.99, 1],
    border: [0.82, 0.88, 0.95]
  });
  page.drawText("Key Insights", {
    x: LEFT_MARGIN + 12,
    y: y - 20,
    size: 11,
    font: params.titleFont,
    color: rgb(0.09, 0.25, 0.38)
  });

  let insightY = y - 38;
  for (const insight of params.insights.slice(0, 5)) {
    page.drawText("•", {
      x: LEFT_MARGIN + 12,
      y: insightY,
      size: 11,
      font: params.bodyFont,
      color: rgb(0.17, 0.38, 0.62)
    });
    insightY = drawWrappedText({
      page,
      text: insight,
      font: params.bodyFont,
      size: 9,
      x: LEFT_MARGIN + 22,
      y: insightY + 1,
      maxWidth: CONTENT_WIDTH - 34,
      color: [0.2, 0.24, 0.31],
      lineHeight: 12
    });
    insightY -= 4;
    if (insightY < 56) {
      break;
    }
  }

  page.drawText("Generated visual summary for rapid executive interpretation.", {
    x: LEFT_MARGIN,
    y: 24,
    size: 8,
    font: params.bodyFont,
    color: rgb(0.45, 0.5, 0.58)
  });
}
