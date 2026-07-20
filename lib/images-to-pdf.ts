import { PDFDocument } from "pdf-lib";

/**
 * Build a single PDF (one image per page) from a list of image URLs.
 * LinkedIn renders a multi-page PDF as a swipeable "carousel" document, which is
 * the reliable way to publish a multi-image carousel as an organic member post.
 *
 * Only JPG and PNG can be embedded (pdf-lib limitation) — our carousel images
 * are AI-generated JPEG/PNG. Returns null if nothing could be embedded.
 */
export async function imagesToPdf(imageUrls: string[]): Promise<Uint8Array | null> {
  const pdfDoc = await PDFDocument.create();
  let added = 0;

  for (const url of imageUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());

      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50; // \x89PNG
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8; // JPEG SOI

      let img;
      if (isPng) {
        img = await pdfDoc.embedPng(bytes);
      } else if (isJpg) {
        img = await pdfDoc.embedJpg(bytes);
      } else {
        // Unknown signature — try JPEG first, then PNG.
        try {
          img = await pdfDoc.embedJpg(bytes);
        } catch {
          img = await pdfDoc.embedPng(bytes);
        }
      }

      // One page per image, sized to the image to preserve its aspect ratio.
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      added++;
    } catch (err) {
      console.error("imagesToPdf: failed to embed image", url, (err as Error).message);
    }
  }

  if (added === 0) return null;
  return pdfDoc.save();
}
