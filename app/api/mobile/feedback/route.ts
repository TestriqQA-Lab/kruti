/**
 * POST /api/mobile/feedback
 * Receives app-level or post-level feedback from mobile client.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, postId, rating, comment } = await req.json().catch(() => ({}));

    if (!type || !rating) {
      return NextResponse.json(
        { error: "Missing required fields (type, rating)" },
        { status: 400 }
      );
    }

    // Log the feedback to server console / system logs
    console.log(
      `[FEEDBACK] User: ${userId} | Type: ${type} | PostId: ${postId || "N/A"} | Rating: ${rating}/5 | Comment: ${comment || "(none)"}`
    );

    return NextResponse.json({ ok: true, message: "Feedback received" });
  } catch (err: any) {
    console.error("[mobile/feedback] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
