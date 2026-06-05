/**
 * POST /api/mobile/posts/[id]/regenerate
 * Body (optional): { humanMode?: boolean }
 *
 * Regenerates a single post's text in the chosen mode. If `humanMode` is sent
 * it is persisted as the post's humanModeOverride first, then used. Otherwise
 * the effective mode = post.humanModeOverride ?? user.humanMode.
 *
 * Mobile (Bearer) version of the web single-post regenerate route.
 * Place at: app/api/mobile/posts/[id]/regenerate/route.ts
 *
 * NOTE: On failure this returns the REAL error message (not a generic string)
 * so issues are visible in the app toast / network tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildSinglePostPrompt } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";

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
      include: { plan: true },
    });
    if (!post)
      return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Optional body: set + persist the per-post override before generating.
    // Wrapped so a missing humanModeOverride column / empty body can't 500.
    let override: boolean | null | undefined = post.humanModeOverride;
    try {
      const body = await req.json().catch(() => ({}));
      if (body && typeof body.humanMode === "boolean") {
        override = body.humanMode;
        try {
          await prisma.post.update({
            where: { id: post.id },
            data: { humanModeOverride: body.humanMode },
          });
        } catch (e) {
          // Column may not exist yet (prisma db push not run) — ignore, we
          // still regenerate using the requested mode.
          console.warn("[regenerate] could not persist humanModeOverride:", e);
        }
      }
    } catch {
      /* no body — fine */
    }

    // Theme from the plan strategy (defensive — strategy may be null/invalid).
    let weekTheme = "Professional Insights";
    try {
      if (post.plan?.strategy) {
        const strategy = JSON.parse(post.plan.strategy) as {
          weekTheme?: string;
          weeks?: Array<{ weekNumber: number; theme: string }>;
        };
        weekTheme =
          strategy.weekTheme ??
          strategy.weeks?.find((w) => w.weekNumber === post.weekNumber)
            ?.theme ??
          "Professional Insights";
      }
    } catch {
      weekTheme = "Professional Insights";
    }

    const effectiveHumanMode =
      override !== null && override !== undefined
        ? override
        : (user.humanMode ?? false);

    const profileContext = buildProfileContext(user);
    const prompt = buildSinglePostPrompt(
      profileContext,
      post.title,
      post.postType,
      weekTheme,
      effectiveHumanMode,
    );

    const raw = await generateText(prompt);

    let generated: {
      title?: string;
      body?: string;
      hashtags?: string[];
      imagePrompt?: string;
    };
    try {
      generated = parseJSON(raw);
    } catch (e) {
      console.error("[regenerate] JSON parse failed. Raw output:", raw);
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

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        title: generated.title ?? post.title,
        body: generated.body,
        hashtags: JSON.stringify(generated.hashtags ?? []),
        ...(generated.imagePrompt
          ? { imagePrompt: generated.imagePrompt }
          : {}),
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