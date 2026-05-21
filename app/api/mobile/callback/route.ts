/**
 * Mobile OAuth Callback — FIXED v3.1
 *
 * v3.1 fix (sign-in "unexpected_error"):
 *   v3 wrote token_type + scope into the Account table. Those columns are
 *   not guaranteed to exist in this project's Account model, so Prisma threw
 *   "Unknown argument" -> caught by the outer catch -> "unexpected_error".
 *   Now:
 *     - token_type / scope are NOT written (not needed for publishing).
 *     - The token-storage block is best-effort: wrapped in its own try/catch
 *       so a DB issue can never block sign-in. The real error is logged.
 *
 * v3 fix (THE publish bug):
 *   The callback fetched a fresh access_token but never saved it. Now it
 *   persists access_token + expires_at to the Account table and stores the
 *   LinkedIn member id (profile.sub) on user.linkedinId + providerAccountId.
 *
 * v2 fixes (kept):
 *   1. redirect_uri is FIXED (not reconstructed from headers).
 *   2. The real LinkedIn token-exchange error is passed back to the app.
 *
 * Path: app/api/mobile/callback/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { syncLinkedInProfile } from "@/lib/linkedin";

const APP_REDIRECT_URI = "krutimobile://oauth-callback";

const MOBILE_REDIRECT_URI =
  process.env.MOBILE_OAUTH_REDIRECT_URI ||
  "https://kruti-git-mobile-auth-integration-testriqqa-labs-projects.vercel.app/api/mobile/callback";

function buildErrorRedirect(error: string) {
  return buildHtmlRedirect(
    `${APP_REDIRECT_URI}?error=${encodeURIComponent(error)}`,
  );
}

function buildHtmlRedirect(targetUrl: string) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Signing you in...</title>
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
  <h2>Returning to Kruti...</h2>
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
      console.warn("[mobile/callback] LinkedIn returned error:", oauthError);
      return buildErrorRedirect(oauthError);
    }
    if (!code) {
      return buildErrorRedirect("missing_code");
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const authSecret = process.env.NEXTAUTH_SECRET;
    if (!clientId || !clientSecret || !authSecret) {
      console.error("[mobile/callback] Missing env vars:", {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasAuthSecret: !!authSecret,
      });
      const missing = [
        !clientId && "CLIENT_ID",
        !clientSecret && "CLIENT_SECRET",
        !authSecret && "NEXTAUTH_SECRET",
      ]
        .filter(Boolean)
        .join(",");
      return buildErrorRedirect(`server_misconfigured:${missing}`);
    }

    // -- FIXED redirect_uri (no header reconstruction) --
    const redirectUri = MOBILE_REDIRECT_URI;
    console.log("[mobile/callback] redirect_uri:", redirectUri);

    // -- Exchange code for access token --
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
      },
    );

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[mobile/callback] Token exchange failed");
      console.error("[mobile/callback]   status:", tokenRes.status);
      console.error("[mobile/callback]   redirect_uri:", redirectUri);
      console.error("[mobile/callback]   LinkedIn says:", errText);

      let detail = `${tokenRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.error || parsed.error_description || detail;
      } catch {
        detail = errText.slice(0, 60) || detail;
      }
      return buildErrorRedirect(`token_exchange_failed:${detail}`);
    }

    // -- Read the FULL token response --
    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    const expiresIn: number | undefined = tokenData.expires_in;
    const grantedScope: string = tokenData.scope ?? "";

    if (!accessToken) {
      console.error("[mobile/callback] No access_token in token response");
      return buildErrorRedirect("no_access_token");
    }

    // DEBUG: confirm w_member_social was actually granted (log only, no DB).
    console.log("[mobile/callback] granted scope:", grantedScope);
    if (!grantedScope.includes("w_member_social")) {
      console.warn(
        "[mobile/callback] WARNING: w_member_social NOT granted — " +
        "publishing to LinkedIn will fail. Check the auth-URL scope param.",
      );
    }

    // -- Fetch LinkedIn profile (OpenID Connect userinfo) --
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const errText = await profileRes.text();
      console.error("[mobile/callback] Profile fetch failed:", errText);
      return buildErrorRedirect("profile_fetch_failed");
    }

    const profile = await profileRes.json();

    if (!profile.email) {
      return buildErrorRedirect("email_missing");
    }

    // LinkedIn member id — needed later to post on the user's behalf.
    const linkedinMemberId: string | undefined = profile.sub;

    // -- Find or create user --
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

    // -- Best-effort: store the LinkedIn member id on the user --
    // Wrapped so a DB issue can never block sign-in.
    if (linkedinMemberId) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { linkedinId: linkedinMemberId },
        });
      } catch (e) {
        console.error("[mobile/callback] linkedinId update failed:", e);
      }
    } else {
      console.warn("[mobile/callback] profile.sub missing — publishing may fail");
    }

    // -- Best-effort: persist the fresh access token to the Account table --
    // This is what enables publishing. If it fails, sign-in still succeeds
    // and the real Prisma error is logged here for diagnosis.
    try {
      const expiresAt = expiresIn
        ? Math.floor(Date.now() / 1000) + expiresIn
        : null;

      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: "linkedin" },
      });

      if (existingAccount) {
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            ...(linkedinMemberId
              ? { providerAccountId: linkedinMemberId }
              : {}),
            access_token: accessToken,
            expires_at: expiresAt,
          },
        });
        console.log("[mobile/callback] Account token updated for", user.id);
      } else {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "linkedin",
            providerAccountId: linkedinMemberId ?? user.id,
            access_token: accessToken,
            expires_at: expiresAt,
          },
        });
        console.log("[mobile/callback] Account token created for", user.id);
      }
    } catch (e) {
      console.error("[mobile/callback] LinkedIn token store failed:", e);
    }

    // -- Sync LinkedIn profile (best-effort) --
    try {
      await syncLinkedInProfile(user.id, accessToken);
    } catch (err) {
      console.error("[mobile/callback] syncLinkedInProfile failed:", err);
    }

    // -- Ensure trial subscription --
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

    // -- Generate JWT --
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { subscription: true },
    });

    const token = await encode({
      token: {
        uid: user.id,
        role: (fullUser as any)?.role ?? "user",
        onboardingCompleted: (fullUser as any)?.onboardingCompleted ?? false,
        subscriptionStatus: fullUser?.subscription?.status ?? "none",
        trialEnd: fullUser?.subscription?.trialEnd?.toISOString() ?? null,
        email: profile.email,
        name: userData.name,
        picture: profile.picture,
      },
      secret: authSecret,
      maxAge: 24 * 60 * 60,
    });

    console.log("[mobile/callback] Success — scope:", grantedScope);
    return buildHtmlRedirect(
      `${APP_REDIRECT_URI}?token=${encodeURIComponent(token)}`,
    );
  } catch (err: any) {
    console.error("[mobile/callback] Unexpected error:", err);
    return buildErrorRedirect("unexpected_error");
  }
}