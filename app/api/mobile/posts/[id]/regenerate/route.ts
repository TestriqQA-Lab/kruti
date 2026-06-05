/**
 * POST /api/mobile/posts/[id]/regenerate
 * Body (optional): { humanMode?: boolean }
 *
 * RESTYLES the existing post into the chosen mode (Human <-> AI) WITHOUT
 * changing its topic/title/meaning. Strips any stray Markdown asterisks.
 * If `humanMode` is sent it is persisted as the post's humanModeOverride.
 *
 * Place at: app/api/mobile/posts/[id]/regenerate/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildRestylePrompt } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";

// Remove any Markdown asterisks the model might still emit.
function stripStars(t: string): string {
  if (!t) return t;
  return t
    .replace(/^[ \t]*\*+[ \t]*/gm, "") // "* " bullets at line start
    .replace(/\*+/g, "") // any remaining * / ** emphasis
    .replace(/[ \t]+$/gm, ""); // trim trailing spaces left behind
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const post = await prisma.post.findFirst({
      where: { id: params.id, plan: { userId } },
    });
    if (!post)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Resolve + persist the requested mode.
    let mode: boolean =
      post.humanModeOverride !== null && post.humanModeOverride !== undefined
        ? post.humanModeOverride
        : (user.humanMode ?? false);
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.humanMode === "boolean") {
        mode = body.humanMode;
        try {
          await prisma.post.update({
            where: { id: post.id },
            data: { humanModeOverride: body.humanMode },
          });
        } catch (e) {
          console.warn("[regenerate] couldn't persist humanModeOverride:", e);
        }
      }
    } catch {
      /* no body — fine */
    }

    const profileContext = buildProfileContext(user);

    // Restyle the EXISTING content — keep title/topic, change only style.
    const prompt = buildRestylePrompt(
      profileContext,
      post.title,
      post.body,
      mode,
    );

    const raw = await generateText(prompt);

    let generated: { body?: string; hashtags?: string[] };
    try {
      generated = parseJSON(raw);
    } catch (e) {
      console.error("[regenerate] JSON parse failed. Raw:", raw);
      return NextResponse.json(
        { error: "AI returned invalid JSON — please try again" },
        { status: 502 },
      );
    }

    if (!generated?.body) {
      return NextResponse.json(
        { error: "AI returned an empty post — please try again" },
        { status: 502 },
      );
    }

    const cleanBody = stripStars(generated.body);
    const cleanHashtags = Array.isArray(generated.hashtags)
      ? generated.hashtags.map((h) => String(h).replace(/[#*]/g, "").trim())
      : [];

    // Title stays exactly the same — only the body/hashtags are restyled.
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        body: cleanBody,
        hashtags: JSON.stringify(cleanHashtags),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("[mobile/posts/[id]/regenerate] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to regenerate post" },
      { status: 500 },
    );
  }
}