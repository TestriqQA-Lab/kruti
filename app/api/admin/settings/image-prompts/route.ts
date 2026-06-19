import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import {
  getImagePromptsRevealUntil,
  setImagePromptsReveal,
  clearImagePromptsReveal,
  type RevealWindowHours,
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

  let hours: 24 | 48 = 24;
  if (action === "enable") {
    const h = Number(body?.hours);
    if (h !== 24 && h !== 48) {
      return NextResponse.json({ error: "hours must be 24 or 48" }, { status: 400 });
    }
    hours = h;
  }

  try {
    if (action === "disable") await clearImagePromptsReveal();
    else await setImagePromptsReveal(hours as RevealWindowHours);
    return NextResponse.json(await currentState());
  } catch (e) {
    console.error("[admin settings] image-prompts toggle failed:", (e as Error).message);
    return NextResponse.json(
      { error: "Couldn't update the setting. The database may not be migrated yet." },
      { status: 500 }
    );
  }
}
