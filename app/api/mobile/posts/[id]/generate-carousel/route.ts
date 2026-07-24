/**
 * POST /api/mobile/posts/[id]/generate-carousel
 *
 * Generates a 4-slide LinkedIn carousel from the post's content:
 *   1. Gemini splits the post into 4 slides (hook + 3 points, last has a CTA).
 *   2. Each slide gets a text-free AI background image.
 *   3. The slide text (heading + body) is composited onto the background.
 *   4. All 4 slide PNGs are uploaded and saved to the post's `images` array.
 *
 * Place at: app/api/mobile/posts/[id]/generate-carousel/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { generatePostImage } from "@/lib/imagen";
import { renderSlide } from "@/lib/carousel";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { getMobileUserId } from "@/lib/mobileAuth";

// Image generation dominates this route. Backgrounds now run in parallel, but
// keep a wide ceiling so a slow model can't fail the whole carousel.
export const maxDuration = 300;

const SLIDE_COUNT = 4;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: reason, subscriptionRequired: true },
      { status: 403 },
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
    include: { plan: { include: { user: { select: { industry: true } } } } },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const industry = post.plan.user.industry || "business";

  // ── Step 1: split the post into 4 slides ──
  const prompt = `You are designing a LinkedIn carousel (${SLIDE_COUNT} slides) from this post.

Post title: ${post.title}
Post body: ${post.body}

Break it into EXACTLY ${SLIDE_COUNT} slides. Slide 1 is a punchy hook. Slides 2-${SLIDE_COUNT - 1} each cover ONE key point/insight. The final slide ends with a soft call-to-action.

For each slide return:
- "heading": 2 to 7 words, punchy (shown large on the slide)
- "body": 1 short sentence, max ~110 characters, expanding the heading
- "imagePrompt": a text-free visual scene/metaphor for the slide background (absolutely NO words, letters or numbers in the image)

Return ONLY a JSON array of ${SLIDE_COUNT} objects: [{"heading","body","imagePrompt"}]. No markdown, no explanation.`;

  let slides: Array<{ heading: string; body: string; imagePrompt: string }>;
  try {
    const raw = await generateText(prompt);
    slides = parseJSON(raw);
  } catch (err) {
    console.error("[generate-carousel] slide split failed:", err);
    return NextResponse.json(
      { error: "Couldn't build the carousel outline — please try again." },
      { status: 502 },
    );
  }

  if (!Array.isArray(slides) || slides.length === 0) {
    return NextResponse.json(
      { error: "AI returned no slides — please try again." },
      { status: 502 },
    );
  }
  // Normalise to exactly SLIDE_COUNT.
  slides = slides.slice(0, SLIDE_COUNT);
  while (slides.length < SLIDE_COUNT) {
    slides.push({ heading: post.title, body: "", imagePrompt: "" });
  }

  // ── Step 2: generate every slide background IN PARALLEL ──
  // These are independent, and generating them one after another meant the
  // slowest part of the route scaled with SLIDE_COUNT — four sequential
  // high-quality generations overran the function timeout and failed the
  // whole carousel. In parallel the step costs roughly one generation.
  const backgrounds = await Promise.all(
    slides.map(async (s, i) => {
      try {
        return await generatePostImage(
          s.imagePrompt || `Abstract professional ${industry} background`,
          `${post.id}-c${i}`,
          industry,
        );
      } catch (err) {
        console.warn(
          `[generate-carousel] slide ${i} bg failed, using brand fill`,
          err,
        );
        return null;
      }
    }),
  );

  // ── Steps 3-4: render + upload each slide ──
  // Per-slide failures must not take the whole carousel down — a slide that
  // can't render is skipped, and we only give up if none survived.
  const urls: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    try {
      // renderSlide (next/og) fetches the background URL itself and overlays the
      // text reliably (no fontconfig dependency).
      const png = await renderSlide(backgrounds[i], {
        index: i + 1,
        total: SLIDE_COUNT,
        heading: s.heading || `Slide ${i + 1}`,
        body: s.body || "",
      });

      const blob = await put(
        `carousel/post-${post.id}-${i}-${Date.now()}.png`,
        png,
        { access: "public", contentType: "image/png" },
      );
      urls.push(blob.url);
    } catch (err) {
      console.error(`[generate-carousel] slide ${i} render/upload failed:`, err);
    }
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "Failed to render the carousel — please try again." },
      { status: 500 },
    );
  }

  // Save as the post's carousel; first slide is the cover.
  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      images: JSON.stringify(urls),
      imageUrl: urls[0],
      // Keep the whole slide set so it can be restored later for free.
      imageHistory: appendImageHistory(post.imageHistory, urls),
    },
  });

  return NextResponse.json({ images: urls, imageUrl: updated.imageUrl });
}
