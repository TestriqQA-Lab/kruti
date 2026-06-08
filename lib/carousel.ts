import sharp from "sharp";

const SIZE = 1080; // square slide, LinkedIn-friendly
const BRAND = "#5B52C9";

export interface SlideMeta {
  index: number; // 1-based
  total: number;
  heading: string;
  body: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Greedy word-wrap by approximate character budget per line.
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || "").trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (!line) {
      line = w;
    } else if ((line + " " + w).length <= maxChars) {
      line += " " + w;
    } else {
      lines.push(line);
      line = w;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

// Build the SVG overlay: dark scrim for readability + slide number + heading +
// body + brand mark. Sits on top of the AI background (or solid brand fill).
function buildSlideSvg({ index, total, heading, body }: SlideMeta): string {
  const headLines = wrapText(heading.toUpperCase(), 18, 4);
  const bodyLines = wrapText(body, 40, 4);

  // Vertical layout: headings sit in the lower-middle, body beneath.
  const headFont = headLines.length > 2 ? 78 : 92;
  const headLineH = headFont + 14;
  const bodyFont = 40;
  const bodyLineH = bodyFont + 12;

  const blockH = headLines.length * headLineH + 24 + bodyLines.length * bodyLineH;
  let y = SIZE - 150 - blockH; // anchor block above the footer
  if (y < 360) y = 360;

  const headTspans = headLines
    .map((l, i) => {
      const ly = y + i * headLineH;
      return `<text x="80" y="${ly}" font-family="Arial, Helvetica, sans-serif" font-size="${headFont}" font-weight="800" fill="#FFFFFF">${escapeXml(l)}</text>`;
    })
    .join("");

  const bodyStartY = y + headLines.length * headLineH + 24 + bodyFont;
  const bodyTspans = bodyLines
    .map((l, i) => {
      const ly = bodyStartY + i * bodyLineH;
      return `<text x="80" y="${ly}" font-family="Arial, Helvetica, sans-serif" font-size="${bodyFont}" font-weight="500" fill="#E9E7FB">${escapeXml(l)}</text>`;
    })
    .join("");

  return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0B0A1A" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="#0B0A1A" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#0B0A1A" stop-opacity="0.88"/>
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#scrim)"/>
  <!-- slide number badge -->
  <rect x="80" y="80" width="120" height="56" rx="28" fill="${BRAND}"/>
  <text x="140" y="118" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800" fill="#FFFFFF" text-anchor="middle">${index} / ${total}</text>
  <!-- accent bar -->
  <rect x="80" y="${y - 54}" width="74" height="10" rx="5" fill="${BRAND}"/>
  ${headTspans}
  ${bodyTspans}
  <!-- brand mark -->
  <text x="${SIZE - 80}" y="${SIZE - 70}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="800" fill="#FFFFFF" text-anchor="end">Kruti</text>
</svg>`;
}

/**
 * Render one carousel slide: AI background (or solid brand fill if none) with
 * the slide text composited on top. Returns a PNG buffer.
 */
export async function renderSlide(
  bgBuffer: Buffer | null,
  meta: SlideMeta,
): Promise<Buffer> {
  const base = bgBuffer
    ? sharp(bgBuffer).resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    : sharp({
        create: {
          width: SIZE,
          height: SIZE,
          channels: 4,
          background: { r: 91, g: 82, b: 201, alpha: 1 },
        },
      });

  const svg = buildSlideSvg(meta);
  return base
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
