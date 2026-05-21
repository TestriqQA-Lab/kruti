/**
 * Mobile OAuth Callback — FIXED v3
 *
 * v3 fix (THE publish bug):
 *   The mobile callback fetched a fresh LinkedIn access_token but NEVER
 *   saved it to the database. postToLinkedIn() reads the token from the
 *   `Account` table via getValidAccessToken() — so publishing always used
 *   a stale token (or none), which LinkedIn rejected with 401 "revoked".
 *   Re-login never fixed it because every login discarded the fresh token.
 *
 *   Now: after token exchange we persist access_token + expires_at + scope
 *   to the Account table, and store the LinkedIn member id (profile.sub)
 *   on both user.linkedinId and account.providerAccountId.
 *
 *   NO Prisma migration needed — these fields already exist on the
 *   standard NextAuth `Account` model used by the web app.
 *
 * v2 fixes (kept):
 *   1. redirect_uri is FIXED (not reconstructed from headers).
 *   2. The real LinkedIn error is passed back to the app.
 *
 * Path: app/api/mobile/callback/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { syncLinkedInProfile } from "@/lib/linkedin";

const APP_REDIRECT_URI = "krutimobile://oauth-callback";

/**
 * CRITICAL - OAuth redirect URI.
 * Must be byte-for-byte identical in 3 places:
 *   1. Mobile app constants/config.ts -> LINKEDIN_OAUTH.REDIRECT_URI
 *   2. Here (the token exchange below)
 *   3. LinkedIn Developer Portal -> Auth -> Authorized redirect URLs
 */
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

      // Extract the real LinkedIn error + pass it to the app
      let detail = `${tokenRes.status}`;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.error || parsed.error_description || detail;
      } catch {
        detail = errText.slice(0, 60) || detail;
      }
      return buildErrorRedirect(`token_exchange_failed:${detail}`);
    }

    // -- Read the FULL token response (not just access_token) --
    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    const expiresIn: number | undefined = tokenData.expires_in;
    const grantedScope: string = tokenData.scope ?? "";
    const tokenType: string = tokenData.token_type ?? "Bearer";

    if (!accessToken) {
      console.error("[mobile/callback] No access_token in token response");
      return buildErrorRedirect("no_access_token");
    }

    // DEBUG: confirm w_member_social was actually granted.
    // If this log does NOT contain "w_member_social", publishing WILL fail
    // and the fix is in the mobile app's authorization-URL builder.
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

    // LinkedIn member id — required to post on the user's behalf.
    // With OpenID Connect this is the `sub` claim from /v2/userinfo.
    const linkedinMemberId: string | undefined = profile.sub;
    if (!linkedinMemberId) {
      console.error("[mobile/callback] profile.sub missing — cannot post later");
      return buildErrorRedirect("linkedin_id_missing");
    }

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

    // -- Store the LinkedIn member id on the user --
    // postToLinkedIn() prefers user.linkedinId for the urn:li:person URN.
    await prisma.user.update({
      where: { id: user.id },
      data: { linkedinId: linkedinMemberId },
    });

    // -- THE FIX: persist the fresh LinkedIn access token to the Account table --
    // getValidAccessToken() / postToLinkedIn() read the token from here.
    // Without this, publishing always uses a stale token -> 401 "revoked".
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
          providerAccountId: linkedinMemberId,
          access_token: accessToken,
          expires_at: expiresAt,
          token_type: tokenType,
          scope: grantedScope,
        },
      });
      console.log("[mobile/callback] Account token updated for user", user.id);
    } else {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: "linkedin",
          providerAccountId: linkedinMemberId,
          access_token: accessToken,
          expires_at: expiresAt,
          token_type: tokenType,
          scope: grantedScope,
        },
      });
      console.log("[mobile/callback] Account token created for user", user.id);
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

    console.log(
      "[mobile/callback] Success — token stored, scope:",
      grantedScope,
    );
    return buildHtmlRedirect(
      `${APP_REDIRECT_URI}?token=${encodeURIComponent(token)}`,
    );
  } catch (err: any) {
    console.error("[mobile/callback] Unexpected error:", err);
    return buildErrorRedirect("unexpected_error");
  }
}