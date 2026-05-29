/**
 * Mobile OAuth Callback — FIXED v3.4
 *
 * v3.4 change (mandatory plan-selection):
 *   Removed the automatic 7-day trial creation block. Previously every
 *   first-time sign-in created a trialing Subscription row, which made
 *   the SubscriptionGate think the user had access — so it skipped the
 *   plan-selection screen. Now NO Subscription row is created here;
 *   the user must explicitly choose "Activate Trial" or "Subscribe"
 *   on the plan-selection screen, which then creates the row.
 *
 * v3.3 change (transit page redesign):
 *   The HTML "Returning to Kruti..." page is now Kruti-branded, light
 *   themed, and tries harder to open the app automatically so the user
 *   never needs to refresh:
 *     - Fires the krutimobile:// deep link immediately AND retries it a
 *       few times (Android sometimes ignores the very first attempt).
 *     - Big, clear "Open Kruti App" button as a manual fallback.
 *     - An explicit "Do not refresh this page" warning — refreshing
 *       re-uses the one-time OAuth code and causes
 *       token_exchange_failed:invalid_request.
 *   The token-exchange logic is UNCHANGED from v3.2 (it works).
 *
 * v3.2 fix: linkedinId UNIQUE-constraint safe (setLinkedInId).
 * v3.1 fix: token storage best-effort.
 * v3   fix: persists access_token + expires_at so publishing works.
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

/**
 * Kruti-branded transit page. Auto-opens the app, retries the deep link,
 * and warns the user not to refresh (refresh re-uses the OAuth code).
 */
function buildHtmlRedirect(targetUrl: string) {
  const safeTarget = JSON.stringify(targetUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Returning to Kruti</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #EFF6FF;
      color: #0F172A;
      padding: 24px;
    }
    .card {
      background: #FFFFFF;
      border-radius: 24px;
      padding: 36px 28px;
      max-width: 360px;
      width: 100%;
      text-align: center;
      box-shadow: 0 18px 48px rgba(10,102,194,0.16);
    }
    .logo {
      width: 76px;
      height: 76px;
      border-radius: 20px;
      background: #0A66C2;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 22px;
      box-shadow: 0 10px 26px rgba(10,102,194,0.34);
    }
    .logo span {
      color: #FFFFFF;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: -2px;
    }
    .spinner {
      width: 34px;
      height: 34px;
      border: 3px solid #DBEAFE;
      border-top-color: #0A66C2;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
      margin: 0 auto 18px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.4px;
      margin-bottom: 8px;
    }
    p {
      font-size: 13.5px;
      color: #64748B;
      line-height: 1.5;
      margin-bottom: 22px;
    }
    .btn {
      display: block;
      background: #0A66C2;
      color: #FFFFFF;
      text-decoration: none;
      font-size: 15px;
      font-weight: 700;
      padding: 15px 20px;
      border-radius: 14px;
      box-shadow: 0 10px 22px rgba(10,102,194,0.32);
    }
    .btn:active { opacity: 0.9; }
    .warn {
      margin-top: 18px;
      font-size: 12px;
      font-weight: 600;
      color: #B45309;
      background: #FEF3C7;
      border-radius: 10px;
      padding: 10px 12px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span>K</span></div>
    <div class="spinner"></div>
    <h1>Returning to Kruti</h1>
    <p>Taking you back to the app. This only takes a moment.</p>
    <a class="btn" id="openBtn" href="${targetUrl}">Open Kruti App</a>
    <div class="warn">Please don't refresh this page — it will interrupt sign-in.</div>
  </div>
  <script>
    (function () {
      var target = ${safeTarget};
      function go() { window.location.href = target; }
      // Fire immediately, then retry — Android sometimes ignores the
      // first deep-link attempt right after the browser regains focus.
      go();
      setTimeout(go, 600);
      setTimeout(go, 1500);
      setTimeout(go, 3000);
      document.getElementById("openBtn").addEventListener("click", function (e) {
        e.preventDefault();
        go();
      });
    })();
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Prevent the browser from caching this one-time page.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Safely set user.linkedinId, handling the UNIQUE constraint.
 */
async function setLinkedInId(userId: string, linkedinId: string) {
  try {
    const owner = await prisma.user.findUnique({
      where: { linkedinId },
    });

    if (owner && owner.id !== userId) {
      await prisma.user.update({
        where: { id: owner.id },
        data: { linkedinId: null },
      });
      console.log(
        "[mobile/callback] linkedinId moved from",
        owner.id,
        "to",
        userId,
      );
    }

    if (!owner || owner.id !== userId) {
      await prisma.user.update({
        where: { id: userId },
        data: { linkedinId },
      });
    }
  } catch (e) {
    console.error("[mobile/callback] setLinkedInId failed:", e);
  }
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

    const tokenData = await tokenRes.json();
    const accessToken: string | undefined = tokenData.access_token;
    const expiresIn: number | undefined = tokenData.expires_in;
    const grantedScope: string = tokenData.scope ?? "";

    if (!accessToken) {
      console.error("[mobile/callback] No access_token in token response");
      return buildErrorRedirect("no_access_token");
    }

    console.log("[mobile/callback] granted scope:", grantedScope);
    if (!grantedScope.includes("w_member_social")) {
      console.warn(
        "[mobile/callback] WARNING: w_member_social NOT granted — " +
          "publishing to LinkedIn will fail.",
      );
    }

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

    const linkedinMemberId: string | undefined = profile.sub;

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

    if (linkedinMemberId) {
      await setLinkedInId(user.id, linkedinMemberId);
    } else {
      console.warn(
        "[mobile/callback] profile.sub missing — publishing may fail",
      );
    }

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

    try {
      await syncLinkedInProfile(user.id, accessToken);
    } catch (err) {
      console.error("[mobile/callback] syncLinkedInProfile failed:", err);
    }

    // -- NO automatic trial creation --
    // The user must explicitly choose "Activate Trial" or "Subscribe"
    // on the plan-selection screen. The subscription row is created
    // there (by /activate-trial or /create-order), not here.

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