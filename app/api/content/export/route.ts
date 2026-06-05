import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/company";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companyProfileId = await getActiveWorkspaceId(session.user.id);
  const posts = await prisma.post.findMany({
    where: { plan: { userId: session.user.id, companyProfileId } },
    orderBy: { scheduledAt: "asc" },
    include: { plan: { select: { weekStart: true } } },
  });

  const headers = [
    "Title", "Body", "Post Type", "Status", "Hashtags",
    "Scheduled At", "Published to LinkedIn", "LinkedIn Post ID",
    "Image URL", "Created At",
  ];

  const rows = posts.map((p) => [
    escapeCSV(p.title),
    escapeCSV(p.body),
    p.postType,
    p.status,
    escapeCSV(p.hashtags ? JSON.parse(p.hashtags).join(", ") : ""),
    p.scheduledAt ? new Date(p.scheduledAt).toISOString() : "",
    p.postedToLinkedIn ? "Yes" : "No",
    p.linkedinPostId || "",
    p.imageUrl || "",
    new Date(p.createdAt).toISOString(),
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kruti-posts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
