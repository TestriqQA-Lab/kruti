import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/linkedin-token";
import { shouldShowWatermark, WATERMARK_TEXT } from "@/lib/subscription-check";
import { formatPostBody, cleanInline } from "@/lib/format";

export interface LinkedInPostResult {
  success: boolean;
  linkedinPostId?: string;
  error?: string;
  requiresReauth?: boolean;
}

export async function postToLinkedIn(
  userId: string,
  post: {
    title?: string | null;   // Hook / opening line — prepended with line breaks
    body: string;
    hashtags: string | null;
    imageUrl: string | null;
    customSignature?: string | null;
  }
): Promise<LinkedInPostResult> {
  // Get a valid (auto-refreshed if needed) LinkedIn access token
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      error: "LinkedIn access token expired. Please sign out and sign in again to reconnect.",
      requiresReauth: true,
    };
  }

  // Get LinkedIn user ID — prefer user.linkedinId, fall back to account.providerAccountId
  const account = await prisma.account.findFirst({
    where: { userId, provider: "linkedin" },
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });
  const linkedinId = user?.linkedinId || account?.providerAccountId;
  if (!linkedinId) {
    return { success: false, error: "No LinkedIn ID found. Please sign out and sign in again." };
  }

  // Backfill linkedinId silently if it was missing
  if (!user?.linkedinId && account?.providerAccountId) {
    prisma.user.update({
      where: { id: userId },
      data: { linkedinId: account.providerAccountId },
    }).catch(() => null);
  }

  // Build full post text: hook → body → hashtags → signature
  const hashtags = post.hashtags ? (JSON.parse(post.hashtags) as string[]) : [];
  const parts: string[] = [];

  // Hook / opening line — directly above the body (no blank line in between)
  const hook = cleanInline(post.title);
  if (hook) {
    parts.push(hook);
  }

  // Main body (markdown stripped, list items spaced)
  parts.push(formatPostBody(post.body));

  // Hashtags
  if (hashtags.length > 0) {
    parts.push("");
    parts.push(hashtags.map((h) => `#${h}`).join(" "));
  }

  // User's post signature (appended to every post, overridden by customSignature if present)
  let signature = user?.postSignature?.trim();
  if (post.customSignature !== undefined && post.customSignature !== null) {
    signature = post.customSignature.trim();
  }
  if (signature) {
    parts.push("");
    parts.push(signature);
  }

  // Kruti.io watermark for trial and lifetime-free-domain users
  if (shouldShowWatermark({
    subscriptionStatus: user?.subscription?.status,
    email: user?.email,
    role: user?.role,
  })) {
    parts.push("");
    parts.push(WATERMARK_TEXT);
  }

  const fullText = parts.join("\n");

  // Build UGC post payload (text only initially)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ugcPost: Record<string, any> = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: fullText },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  // If image exists (Blob URL or any HTTPS URL), upload to LinkedIn first
  if (post.imageUrl && post.imageUrl.startsWith("https://")) {
    try {
      const assetUrn = await uploadImageToLinkedIn(
        accessToken,
        linkedinId,
        post.imageUrl
      );
      if (assetUrn) {
        ugcPost.specificContent = {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: fullText },
            shareMediaCategory: "IMAGE",
            media: [
              {
                status: "READY",
                media: assetUrn,
              },
            ],
          },
        };
      }
    } catch (imgErr) {
      console.error("Image upload to LinkedIn failed, posting without image:", imgErr);
      // Continue posting without image
    }
  }

  // Post to LinkedIn UGC API
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(ugcPost),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("LinkedIn UGC post error:", res.status, errText);

    // If 401, the token might have been revoked despite our refresh check
    if (res.status === 401) {
      return {
        success: false,
        error: "LinkedIn token was revoked. Please sign out and sign in again.",
        requiresReauth: true,
      };
    }

    return {
      success: false,
      error: "Failed to post to LinkedIn. Please try again later.",
    };
  }

  const data = await res.json();
  return { success: true, linkedinPostId: data.id };
}

async function uploadImageToLinkedIn(
  accessToken: string,
  linkedinId: string,
  imageUrl: string
): Promise<string | null> {
  // Step 1: Register upload with LinkedIn
  const registerRes = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${linkedinId}`,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
    }
  );

  if (!registerRes.ok) {
    console.error("LinkedIn image register failed:", await registerRes.text());
    return null;
  }

  const registerData = await registerRes.json();
  const uploadUrl =
    registerData.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]?.uploadUrl;
  const asset = registerData.value?.asset;

  if (!uploadUrl || !asset) {
    console.error("LinkedIn image register: missing uploadUrl or asset");
    return null;
  }

  // Step 2: Fetch image from Blob URL and upload binary to LinkedIn
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    console.error("Failed to fetch image from Blob URL:", imageUrl);
    return null;
  }

  const imageBuffer = await imageRes.arrayBuffer();
  const contentType = imageRes.headers.get("content-type") || "image/png";

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    console.error("LinkedIn image upload PUT failed:", await uploadRes.text());
    return null;
  }

  return asset; // e.g. "urn:li:digitalmediaAsset:C5422AQG..."
}
