import { NextRequest, NextResponse } from "next/server";

/**
 * Simple site-wide password gate.
 * - Set SITE_PASSWORD env var to enable (remove or leave empty to disable)
 * - Visitors must enter the password once → cookie is set for 7 days
 * - API routes, cron jobs, and webhooks are excluded
 */

const COOKIE_NAME = "site-gate";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export function checkSiteGate(req: NextRequest): NextResponse | null {
  const sitePassword = process.env.SITE_PASSWORD;

  // Gate disabled - allow everything
  if (!sitePassword) return null;

  const { pathname } = req.nextUrl;

  // Never gate API routes, cron, webhooks, or the gate page itself
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/site-gate") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js")
  ) {
    return null; // Allow through
  }

  // Check if visitor already authenticated
  const gateCookie = req.cookies.get(COOKIE_NAME)?.value;
  if (gateCookie === sitePassword) {
    return null; // Already authenticated
  }

  // Redirect to gate page
  const gateUrl = new URL("/site-gate", req.url);
  gateUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(gateUrl);
}

export function createGateResponse(password: string): NextResponse {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword || password !== sitePassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, password, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return response;
}
