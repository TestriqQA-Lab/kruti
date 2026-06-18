import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { cropOnePixelBorder } from "@/lib/image-edit";
import { replaceImageHistoryGroup } from "@/lib/image-history";

// Cropping fetches + re-encodes up to several images (carousels are up to 4), so
// give it room beyond the default serverless limit.
export const maxDuration = 60;

/** Fetch a blob image, crop 1px off every side, re-upload, and return the new URL. */
async function cropAndReupload(url: string, postId: string, idx: number): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const input = Buffer.from(await res.arrayBuffer());
  const { buffer, ext, contentType } = await cropOnePixelBorder(input);
  const filename = `cropped-${postId}-${idx}-${Date.now()}.${ext}`;
  const blob = await put(`generated/${filename}`, buffer, { access: "public", contentType });
  return blob.url;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const postId = body?.postId;
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Cropping only re-encodes images the user already has - it never calls the image
  // model, so it does NOT consume a generation and needs no rate/subscription gate
  // beyond ownership.
  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Carousel takes precedence over the single image (same rule as the editor).
  let carousel: string[] = [];
  if (post.carouselImages) {
    try {
      const parsed = JSON.parse(post.carouselImages);
      if (Array.isArray(parsed)) {
        carousel = parsed.filter((u): u is string => typeof u === "string" && u.length > 0);
      }
    } catch {
      carousel = [];
    }
  }

  try {
    if (carousel.length > 0) {
      // Crop every slide (order preserved); imageUrl follows the cropped first slide.
      const cropped = await Promise.all(
        carousel.map((u, i) => cropAndReupload(u, postId, i))
      );
      await prisma.post.update({
        where: { id: postId },
        data: {
          carouselImages: JSON.stringify(cropped),
          imageUrl: cropped[0],
          imageHistory: replaceImageHistoryGroup(post.imageHistory, carousel, cropped),
        },
      });
      return NextResponse.json({ carouselImages: cropped, imageUrl: cropped[0] });
    }

    if (post.imageUrl) {
      const newUrl = await cropAndReupload(post.imageUrl, postId, 0);
      await prisma.post.update({
        where: { id: postId },
        data: {
          imageUrl: newUrl,
          imageHistory: replaceImageHistoryGroup(post.imageHistory, [post.imageUrl], [newUrl]),
        },
      });
      return NextResponse.json({ imageUrl: newUrl });
    }

    return NextResponse.json({ error: "This post has no image to crop." }, { status: 400 });
  } catch (err) {
    console.error("[Crop] failed:", (err as Error).message);
    return NextResponse.json({ error: "Couldn't crop the image. Please try again." }, { status: 500 });
  }
}
