/**
 * Mobile OAuth Callback (moved from /api/auth/mobile-callback)
 * Moved here to avoid NextAuth catch-all route conflict on Vercel.
 *
 * Flow:
 *  1. LinkedIn redirects here with ?code=XYZ
 *  2. Exchange code for LinkedIn access token
 *  3. Fetch LinkedIn profile
 *  4. Find/create user in DB (Prisma)
 *  5. Sync LinkedIn profile data
 *  6. Ensure trial subscription
 *  7. Generate NextAuth-compatible JWT
 *  8. Return HTML page that redirects to krutimobile://oauth-callback?token=<JWT>
 */

import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { syncLinkedInProfile } from "@/lib/linkedin";

const APP_REDIRECT_URI = "krutimobile://oauth-callback";

function buildErrorRedirect(error: string) {
  return buildHtmlRedirect(`${APP_REDIRECT_URI}?error=${encodeURIComponent(error)}`);
}

function buildHtmlRedirect(targetUrl: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing you in…</title>
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; color: #1F2937; background: #F9FAFB; }
    .spinner { width: 40px; height: 40px; border: 4px solid #DBEAFE; border-top-color: #1D4ED8; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #1D4ED8; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h2>Returning to Kruti…</h2>
  <p>If nothing happens, <a href="${targetUrl}">tap here</a>.</p>
  <script>window.location.href = ${JSON.stringify(targetUrl)};</script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      return buildErrorRedirect(oauthError);
    }
    if (!code) {
      return buildErrorRedirect("missing_code");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const authSecret = process.env.NEXTAUTH_SECRET;
    if (!clientId || !clientSecret || !authSecret) {
      console.error("[mobile/callback] Missing env vars");
      return buildErrorRedirect("server_misconfigured");
    }

    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host") || "";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("10.")
        ? "http"
        : "https");
    const redirectUri = `${proto}://${host}/api/mobile/callback`;

    const tokenRes = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      }
    );

    if (!tokenRes.ok) {
      console.error(
        "[mobile/callback] Token exchange failed:",
        await tokenRes.text()
      );
      return buildErrorRedirect("token_exchange_failed");
    }

    const { access_token: accessToken } = await tokenRes.json();

    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      console.error("[mobile/callback] Profile fetch failed");
      return buildErrorRedirect("profile_fetch_failed");
    }

    const profile = await profileRes.json();

    if (!profile.email) {
      return buildErrorRedirect("email_missing");
    }

    let user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    const userData = {
      email: profile.email,
      name:
        `${profile.given_name ?? ""} ${profile.family_name ?? ""}`.trim() ||
        profile.email,
      image: profile.picture ?? null,
    };

    if (!user) {
      user = await prisma.user.create({ data: userData });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: userData.name, image: userData.image },
      });
    }

    try {
      await syncLinkedInProfile(user.id, accessToken);
    } catch (err) {
      console.error("[mobile/callback] syncLinkedInProfile failed:", err);
    }

    const existingSub = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });
    if (!existingSub) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      try {
        await prisma.subscription.create({
          data: {
            userId: user.id,
            status: "trialing",
            trialEnd,
            currency: "INR",
          },
        });
      } catch (err) {
        console.error("[mobile/callback] Trial creation failed:", err);
      }
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscription: true },
    });

    const token = await encode({
      token: {
        uid: user.id,
        role: (fullUser as any)?.role ?? "user",
        onboardingCompleted:
          (fullUser as any)?.onboardingCompleted ?? false,
        subscriptionStatus: fullUser?.subscription?.status ?? "none",
        trialEnd: fullUser?.subscription?.trialEnd?.toISOString() ?? null,
        email: profile.email,
        name: userData.name,
        picture: profile.picture,
      },
      secret: authSecret,
      maxAge: 24 * 60 * 60,
    });

    return buildHtmlRedirect(`${APP_REDIRECT_URI}?token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    console.error("[mobile/callback] Unexpected error:", err);
    return buildErrorRedirect("unexpected_error");
  }
}