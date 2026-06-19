import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  getImagePromptsRevealUntil,
  setImagePromptsReveal,
  clearImagePromptsReveal,
  MAX_REVEAL_DAYS,
} from "@/lib/app-settings";

async function currentState() {
  const until = await getImagePromptsRevealUntil();
  const revealed = until !== null && until.getTime() > Date.now();
  return { revealed, revealUntil: revealed && until ? until.toISOString() : null };
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await currentState());
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (action !== "enable" && action !== "disable") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  let days = 1;
  if (action === "enable") {
    days = Number(body?.days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_REVEAL_DAYS) {
      return NextResponse.json(
        { error: `Enter a whole number of days between 1 and ${MAX_REVEAL_DAYS}.` },
        { status: 400 }
      );
    }
  }

  try {
    if (action === "disable") await clearImagePromptsReveal();
    else await setImagePromptsReveal(days);
    return NextResponse.json(await currentState());
  } catch (e) {
    console.error("[admin settings] image-prompts toggle failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Couldn't update the setting. The database may not be migrated yet." },
      { status: 500 }
    );
  }
}
