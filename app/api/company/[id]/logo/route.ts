import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";

// POST /api/company/[id]/logo — upload a company logo to Vercel Blob
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const company = await prisma.companyProfile.findFirst({
    where: { id: params.id, userId: session.user.id, user: { companyProfilesEnabled: true } },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("logo") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No logo file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, GIF, WebP, SVG" },
        { status: 400 }
      );
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "png";
    const filename = `company-logos/logo-${company.id}-${Date.now()}.${ext}`;
    const blob = await put(filename, file, { access: "public", contentType: file.type });

    const updated = await prisma.companyProfile.update({
      where: { id: company.id },
      data: { logoUrl: blob.url },
    });

    return NextResponse.json({ logoUrl: updated.logoUrl });
  } catch (err) {
    console.error("Company logo upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
