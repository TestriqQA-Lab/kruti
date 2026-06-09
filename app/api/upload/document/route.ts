import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export const maxDuration = 60;

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("document") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file) return NextResponse.json({ error: "No PDF file provided" }, { status: 400 });
    if (!postId) return NextResponse.json({ error: "No postId provided" }, { status: 400 });

    // Verify the post belongs to this user
    const post = await prisma.post.findFirst({
      where: { id: postId, plan: { userId: session.user.id } },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 25MB" }, { status: 400 });
    }

    const safeName = (file.name || "document.pdf").replace(/[^\w.\-]+/g, "_").slice(0, 120);
    const filename = `documents/doc-${postId}-${Date.now()}-${safeName}`;
    const blob = await put(filename, file, { access: "public", contentType: "application/pdf" });

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        documentUrl: blob.url,
        documentName: file.name || "document.pdf",
        // A document post replaces image media on LinkedIn - clear images.
        imageUrl: null,
        carouselImages: null,
      },
    });

    return NextResponse.json({
      documentUrl: updated.documentUrl,
      documentName: updated.documentName,
    });
  } catch (err) {
    console.error("Document upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
