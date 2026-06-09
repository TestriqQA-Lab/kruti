import { prisma } from "@/lib/prisma";

/**
 * LinkedIn OAuth Token Refresh
 *
 * LinkedIn access tokens expire after 60 days.
 * Refresh tokens (for approved MDP partners) last 365 days.
 * See: https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
 *
 * For apps WITHOUT programmatic refresh tokens, the user must re-login
 * through the OAuth flow to get a new access token.
 */

interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
  requiresReauth?: boolean;
}

/** Buffer: refresh token 7 days before expiry to avoid edge cases */
const EXPIRY_BUFFER_SECS = 7 * 24 * 60 * 60;

/**
 * Check if a user's LinkedIn access token is still valid.
 * Returns the token if valid, or null if expired/missing.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "linkedin" },
  });

  if (!account?.access_token) return null;

  // If expires_at is set and token is not yet expired (with buffer), return it
  if (account.expires_at) {
    const nowSecs = Math.floor(Date.now() / 1000);
    if (account.expires_at > nowSecs + EXPIRY_BUFFER_SECS) {
      return account.access_token;
    }
  } else {
    // No expires_at recorded - token might still be valid, use it optimistically
    return account.access_token;
  }

  // Token is expired or about to expire - try to refresh
  const result = await refreshAccessToken(userId);
  if (result.success && result.accessToken) {
    return result.accessToken;
  }

  return null;
}

/**
 * Refresh the LinkedIn access token using the stored refresh token.
 * Updates the Account record in the database on success.
 */
export async function refreshAccessToken(userId: string): Promise<TokenRefreshResult> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "linkedin" },
  });

  if (!account) {
    return { success: false, error: "No LinkedIn account found", requiresReauth: true };
  }

  if (!account.refresh_token) {
    // No refresh token available - user must re-login
    // This is expected for apps without MDP partnership
    console.log(`[Token] No refresh token for user ${userId} - re-login required`);
    return {
      success: false,
      error: "No refresh token available. Please sign out and sign in again to reconnect your LinkedIn account.",
      requiresReauth: true,
    };
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { success: false, error: "LinkedIn OAuth credentials not configured" };
  }

  try {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[Token] LinkedIn refresh failed (${res.status}):`, errBody);

      // If refresh token is invalid/expired/revoked, user must re-login
      if (res.status === 400) {
        return {
          success: false,
          error: "LinkedIn refresh token expired or revoked. Please sign out and sign in again.",
          requiresReauth: true,
        };
      }
      return { success: false, error: `LinkedIn token refresh failed: ${res.status}` };
    }

    const data = await res.json();
    const {
      access_token,
      expires_in,
      refresh_token: newRefreshToken,
      refresh_token_expires_in,
    } = data;

    if (!access_token) {
      return { success: false, error: "LinkedIn returned empty access token" };
    }

    // Update the Account record with new tokens
    const nowSecs = Math.floor(Date.now() / 1000);
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token,
        expires_at: expires_in ? nowSecs + expires_in : null,
        // Update refresh token if LinkedIn returned a new one
        ...(newRefreshToken ? { refresh_token: newRefreshToken } : {}),
      },
    });

    console.log(
      `[Token] Refreshed LinkedIn token for user ${userId}. ` +
      `Access expires in ${expires_in}s, refresh expires in ${refresh_token_expires_in ?? "unknown"}s`
    );

    return { success: true, accessToken: access_token };
  } catch (err) {
    console.error("[Token] LinkedIn refresh error:", err);
    return { success: false, error: `Token refresh error: ${err}` };
  }
}

/**
 * Check token health for a user - used by the proactive scheduler.
 * Returns status info without modifying anything.
 */
export async function getTokenStatus(userId: string): Promise<{
  hasToken: boolean;
  hasRefreshToken: boolean;
  isExpired: boolean;
  expiresInDays: number | null;
  refreshable: boolean;
}> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "linkedin" },
  });

  if (!account?.access_token) {
    return { hasToken: false, hasRefreshToken: false, isExpired: true, expiresInDays: null, refreshable: false };
  }

  const nowSecs = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at ?? 0;
  const isExpired = expiresAt > 0 && expiresAt <= nowSecs;
  const expiresInDays = expiresAt > 0
    ? Math.floor((expiresAt - nowSecs) / (24 * 60 * 60))
    : null;

  return {
    hasToken: true,
    hasRefreshToken: !!account.refresh_token,
    isExpired,
    expiresInDays,
    refreshable: !!account.refresh_token,
  };
}
