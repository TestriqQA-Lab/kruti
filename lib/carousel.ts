import { ImageResponse } from "next/og";
import { createElement as h } from "react";

const SIZE = 1080; // square slide, LinkedIn-friendly
const BRAND = "#2563EB";

export interface SlideMeta {
  index: number; // 1-based
  total: number;
  heading: string;
  body: string;
}

// Satori (used by next/og) needs an explicit font — Vercel's serverless image
// (sharp/librsvg) has NO fonts, which is why the old SVG text overlay rendered
// blank ("Fontconfig error"). We fetch a real font once and reuse it.
let fontCache: ArrayBuffer | null = null;
async function loadFont(): Promise<ArrayBuffer | null> {
  if (fontCache) return fontCache;
  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.16/files/inter-latin-700-normal.woff",
    );
    if (res.ok) {
      fontCache = await res.arrayBuffer();
      return fontCache;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Render one carousel slide: AI background (fetched by src) with the slide
 * text, a dark scrim, a "N / total" badge and the Kruti brand composited on
 * top — all via next/og (Satori), which renders text reliably on Vercel.
 * Returns a PNG buffer.
 */
export async function renderSlide(
  bgUrl: string | null,
  meta: SlideMeta,
): Promise<Buffer> {
  const font = await loadFont();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // AI background image (Satori fetches the URL).
  if (bgUrl) {
    children.push(
      h("img", {
        src: bgUrl,
        width: SIZE,
        height: SIZE,
        style: { position: "absolute", top: 0, left: 0, objectFit: "cover" },
      }),
    );
  }

  // Dark scrim for text readability.
  children.push(
    h("div", {
      style: {
        position: "absolute",
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        background:
          "linear-gradient(180deg, rgba(11,10,26,0.25) 0%, rgba(11,10,26,0.55) 55%, rgba(11,10,26,0.9) 100%)",
      },
    }),
  );

  // Slide-number badge (top-left).
  children.push(
    h(
      "div",
      {
        style: {
          position: "absolute",
          top: 60,
          left: 64,
          display: "flex",
          backgroundColor: BRAND,
          color: "#FFFFFF",
          fontSize: 34,
          padding: "10px 28px",
          borderRadius: 30,
        },
      },
      `${meta.index} / ${meta.total}`,
    ),
  );

  // Heading + body block (bottom-left).
  children.push(
    h(
      "div",
      {
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 132,
          display: "flex",
          flexDirection: "column",
        },
      },
      h("div", {
        style: {
          width: 92,
          height: 12,
          backgroundColor: BRAND,
          borderRadius: 6,
          marginBottom: 28,
        },
      }),
      h(
        "div",
        {
          style: {
            color: "#FFFFFF",
            fontSize: 82,
            lineHeight: 1.1,
            letterSpacing: -1,
          },
        },
        meta.heading,
      ),
      meta.body
        ? h(
            "div",
            {
              style: {
                color: "#E9E7FB",
                fontSize: 40,
                marginTop: 24,
                lineHeight: 1.35,
              },
            },
            meta.body,
          )
        : "",
    ),
  );

  // Brand mark (bottom-right).
  children.push(
    h(
      "div",
      {
        style: {
          position: "absolute",
          right: 72,
          bottom: 60,
          display: "flex",
          color: "#FFFFFF",
          fontSize: 36,
        },
      },
      "Kruti",
    ),
  );

  const root = h(
    "div",
    {
      style: {
        width: SIZE,
        height: SIZE,
        display: "flex",
        position: "relative",
        backgroundColor: BRAND, // fallback if the AI image fails to load
      },
    },
    ...children,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = { width: SIZE, height: SIZE };
  if (font) {
    opts.fonts = [{ name: "Inter", data: font, weight: 700, style: "normal" }];
  }

  const resp = new ImageResponse(root, opts);
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}
