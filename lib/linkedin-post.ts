import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/linkedin-token";

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
    images?: string[] | null; // Carousel — multiple image URLs (multi-image post)
    documentUrl?: string | null;  // PDF — published as a LinkedIn document post
    documentName?: string | null;
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
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

  // Hook / opening line (1 blank line before body)
  if (post.title?.trim()) {
    parts.push(post.title.trim());
    parts.push(""); // blank line after hook
  }

  // Main body
  parts.push(post.body);

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

  const fullText = parts.join("\n");

  // If a PDF document is attached, publish it as a LinkedIn document post
  // (swipeable PDF / carousel), which uses a different API than image posts.
  if (post.documentUrl && post.documentUrl.startsWith("https://")) {
    return postDocumentToLinkedIn(
      accessToken,
      linkedinId,
      fullText,
      post.documentUrl,
      post.documentName || "Document",
    );
  }

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

  // Collect the image URLs to publish: prefer the carousel `images` array,
  // fall back to the single `imageUrl`. De-dupe and keep only HTTPS URLs.
  const imageUrls = Array.from(
    new Set(
      [...(post.images ?? []), post.imageUrl].filter(
        (u): u is string => !!u && u.startsWith("https://"),
      ),
    ),
  ).slice(0, 20); // LinkedIn allows up to 20 images in a multi-image post

  console.log(
    `[linkedin-post] images received: ${(post.images ?? []).length}, ` +
      `usable URLs: ${imageUrls.length} → ${imageUrls.length >= 2 ? "MULTI-IMAGE (/rest/posts)" : imageUrls.length === 1 ? "single (ugcPosts)" : "text only"}`,
  );

  // 2+ images → a REAL swipeable carousel via the versioned Posts API.
  // (The legacy /v2/ugcPosts endpoint only ever renders ONE image, which is
  // why carousels were posting a single slide.)
  if (imageUrls.length >= 2) {
    return postImagesToLinkedIn(accessToken, linkedinId, fullText, imageUrls);
  }

  // Single image → legacy single-image UGC post (simple, proven path).
  if (imageUrls.length === 1) {
    try {
      const assetUrn = await uploadImageToLinkedIn(
        accessToken,
        linkedinId,
        imageUrls[0],
      );
      if (assetUrn) {
        ugcPost.specificContent = {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: fullText },
            shareMediaCategory: "IMAGE",
            media: [{ status: "READY", media: assetUrn }],
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

// Escape reserved characters for LinkedIn's /rest/posts commentary ("Little
// Text" format) so the post body isn't rejected.
function escapeLinkedInText(s: string): string {
  return s.replace(/[\\()[\]{}<>@|~_*#]/g, (c) => "\\" + c);
}

// Publish a PDF as a LinkedIn document post (swipeable PDF / carousel) using
// the versioned Documents + Posts API. Returns the same result shape as the
// image path so callers don't care which one ran.
async function postDocumentToLinkedIn(
  accessToken: string,
  linkedinId: string,
  text: string,
  documentUrl: string,
  documentTitle: string,
): Promise<LinkedInPostResult> {
  const VERSION = "202401";
  const owner = `urn:li:person:${linkedinId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": VERSION,
  };

  try {
    // 1. Initialize the document upload.
    const initRes = await fetch(
      "https://api.linkedin.com/rest/documents?action=initializeUpload",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ initializeUploadRequest: { owner } }),
      },
    );
    if (!initRes.ok) {
      const t = await initRes.text();
      console.error("LinkedIn document init failed:", initRes.status, t);
      if (initRes.status === 401)
        return {
          success: false,
          error: "LinkedIn token was revoked. Please sign out and sign in again.",
          requiresReauth: true,
        };
      return { success: false, error: "Couldn't start the document upload on LinkedIn." };
    }
    const initData = await initRes.json();
    const uploadUrl = initData.value?.uploadUrl;
    const documentUrn = initData.value?.document;
    if (!uploadUrl || !documentUrn)
      return { success: false, error: "LinkedIn document init returned no upload URL." };

    // 2. Fetch the PDF from Blob and upload its bytes.
    const pdfRes = await fetch(documentUrl);
    if (!pdfRes.ok)
      return { success: false, error: "Couldn't fetch the PDF for upload." };
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: pdfBuffer,
    });
    if (!uploadRes.ok) {
      console.error("LinkedIn document PUT failed:", await uploadRes.text());
      return { success: false, error: "Failed to upload the PDF to LinkedIn." };
    }

    // 3. Create the document post.
    const postRes = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        author: owner,
        commentary: escapeLinkedInText(text),
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: { id: documentUrn, title: documentTitle.slice(0, 100) },
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!postRes.ok) {
      const t = await postRes.text();
      console.error("LinkedIn document post failed:", postRes.status, t);
      if (postRes.status === 401)
        return {
          success: false,
          error: "LinkedIn token was revoked. Please sign out and sign in again.",
          requiresReauth: true,
        };
      return { success: false, error: "Failed to publish the document post to LinkedIn." };
    }
    const postId =
      postRes.headers.get("x-restli-id") ||
      postRes.headers.get("x-linkedin-id") ||
      undefined;
    return { success: true, linkedinPostId: postId };
  } catch (err) {
    console.error("LinkedIn document post exception:", err);
    return { success: false, error: "Document post failed unexpectedly." };
  }
}

// Publish 2+ images as a real swipeable multi-image (carousel) post using the
// versioned Images + Posts API. The legacy /v2/ugcPosts endpoint only renders
// one image, so multi-image carousels MUST go through this path.
async function postImagesToLinkedIn(
  accessToken: string,
  linkedinId: string,
  text: string,
  imageUrls: string[],
): Promise<LinkedInPostResult> {
  const VERSION = "202401";
  const owner = `urn:li:person:${linkedinId}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": VERSION,
  };

  try {
    // 1. Upload each image via the versioned Images API → collect image URNs.
    const imageUrns: string[] = [];
    for (const url of imageUrls) {
      const initRes = await fetch(
        "https://api.linkedin.com/rest/images?action=initializeUpload",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ initializeUploadRequest: { owner } }),
        },
      );
      if (!initRes.ok) {
        const t = await initRes.text();
        console.error("LinkedIn image init failed:", initRes.status, t);
        if (initRes.status === 401)
          return {
            success: false,
            error: "LinkedIn token was revoked. Please sign out and sign in again.",
            requiresReauth: true,
          };
        continue;
      }
      const initData = await initRes.json();
      const uploadUrl = initData.value?.uploadUrl;
      const imageUrn = initData.value?.image;
      if (!uploadUrl || !imageUrn) continue;

      const imgRes = await fetch(url);
      if (!imgRes.ok) continue;
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: buf,
      });
      if (!putRes.ok) {
        console.error("LinkedIn image PUT failed:", await putRes.text());
        continue;
      }
      imageUrns.push(imageUrn);
    }

    if (imageUrns.length === 0)
      return { success: false, error: "Failed to upload images to LinkedIn." };

    // 2. Build the content — multiImage for 2+, single media for 1.
    const content =
      imageUrns.length === 1
        ? { media: { id: imageUrns[0], altText: "Image" } }
        : {
            multiImage: {
              images: imageUrns.map((id, i) => ({
                id,
                altText: `Slide ${i + 1}`,
              })),
            },
          };

    // 3. Create the post.
    const postRes = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        author: owner,
        commentary: escapeLinkedInText(text),
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content,
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    if (!postRes.ok) {
      const t = await postRes.text();
      console.error("LinkedIn image post failed:", postRes.status, t);
      if (postRes.status === 401)
        return {
          success: false,
          error: "LinkedIn token was revoked. Please sign out and sign in again.",
          requiresReauth: true,
        };
      return { success: false, error: "Failed to publish the carousel to LinkedIn." };
    }
    const postId =
      postRes.headers.get("x-restli-id") ||
      postRes.headers.get("x-linkedin-id") ||
      undefined;
    return { success: true, linkedinPostId: postId };
  } catch (err) {
    console.error("LinkedIn image post exception:", err);
    return { success: false, error: "Carousel post failed unexpectedly." };
  }
}
