import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    if (!postId) {
      return NextResponse.json({ error: "No postId provided" }, { status: 400 });
    }

    // Verify the post belongs to this user
    const post = await prisma.post.findFirst({
      where: { id: postId, plan: { userId: session.user.id } },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename and upload to Vercel Blob
    const ext = file.name.split(".").pop() || "png";
    const filename = `upload-${postId}-${Date.now()}.${ext}`;
    const blob = await put(`uploads/${filename}`, file, {
      access: "public",
      contentType: file.type,
    });

    // Update the post with the new image URL
    await prisma.post.update({
      where: { id: postId },
      data: { imageUrl: blob.url, documentUrl: null, documentName: null },
    });

    return NextResponse.json({ imageUrl: blob.url });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
