import sharp from "sharp";

/**
 * Server-side image edits (sharp) used to manage the LinkedIn "CR"
 * (Content Credentials / C2PA "AI-generated") badge on generated images.
 *
 * Gemini embeds a C2PA manifest in every image it returns; LinkedIn reads it and
 * shows a "CR" tag that flags the image as AI-made. Re-encoding the image drops
 * that embedded manifest, which removes the tag. Two helpers cooperate:
 *   - addSafetyMargin(): at generation time, pad a 1px throwaway border (a copy of
 *     the edge pixels) on all 4 sides, so a later 1px crop trims only that border
 *     and never real content.
 *   - cropOnePixelBorder(): trim 1px off all 4 sides and re-encode - which both
 *     removes the safety margin and strips the C2PA manifest, so the "CR" tag is gone.
 */

/** Map a sharp format name to a Vercel Blob file extension + content type. */
export function formatToBlobMeta(format: string | undefined): { ext: string; contentType: string } {
  switch (format) {
    case "jpeg":
    case "jpg":
      return { ext: "jpg", contentType: "image/jpeg" };
    case "webp":
      return { ext: "webp", contentType: "image/webp" };
    case "png":
    default:
      return { ext: "png", contentType: "image/png" };
  }
}

/**
 * Add a 1px throwaway margin on all 4 sides by copying the edge pixels. Keeps the
 * input format. The border is visually identical to the original edge, so the image
 * looks unchanged - but a later 1px crop removes exactly this padding, never real
 * content.
 */
export async function addSafetyMargin(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .extend({ top: 1, bottom: 1, left: 1, right: 1, extendWith: "copy" })
    .toBuffer();
}

/**
 * Crop 1px off all 4 sides and re-encode. The re-encode drops the embedded C2PA /
 * Content-Credentials manifest, so LinkedIn no longer shows the "CR" AI-content tag.
 * Returns the new buffer plus the blob ext/content type for upload.
 */
export async function cropOnePixelBorder(
  buffer: Buffer
): Promise<{ buffer: Buffer; ext: string; contentType: string }> {
  const meta = await sharp(buffer).metadata();
  const { ext, contentType } = formatToBlobMeta(meta.format);
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  // Too small to trim a border from - just re-encode (still strips the C2PA manifest).
  if (width <= 2 || height <= 2) {
    const out = await sharp(buffer).toBuffer();
    return { buffer: out, ext, contentType };
  }

  const out = await sharp(buffer)
    .extract({ left: 1, top: 1, width: width - 2, height: height - 2 })
    .toBuffer();
  return { buffer: out, ext, contentType };
}
