import { del, list } from "@vercel/blob";
import { prisma } from "@/lib/prisma";

const CLEANUP_AGE_DAYS = 7;

/**
 * Deletes Vercel Blob images for posts that were published 7+ days ago.
 * Sets imageUrl to null in the database (LinkedIn link is preserved via linkedinPostId).
 * Also cleans up orphaned blob files that don't match any post.
 */
export async function cleanupOldImages(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CLEANUP_AGE_DAYS);

  // Find published posts with images that are older than the cutoff
  const postsToClean = await prisma.post.findMany({
    where: {
      postedToLinkedIn: true,
      imageUrl: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      imageUrl: true,
    },
  });

  for (const post of postsToClean) {
    if (!post.imageUrl) continue;

    // Delete the blob from Vercel Blob storage
    try {
      await del(post.imageUrl);
      console.log(`[Cleanup] Deleted blob: ${post.imageUrl}`);
    } catch (err) {
      console.error(`[Cleanup] Failed to delete blob for post ${post.id}:`, (err as Error).message);
      errors++;
    }

    // Clear imageUrl in the database (keep linkedinPostId)
    try {
      await prisma.post.update({
        where: { id: post.id },
        data: { imageUrl: null },
      });
      deleted++;
    } catch (err) {
      console.error(`[Cleanup] Failed to update post ${post.id}:`, (err as Error).message);
      errors++;
    }
  }

  // Clean up orphaned blobs - blobs in the "generated/" prefix that don't match any post
  try {
    // Get all current imageUrl values from the database
    const activePosts = await prisma.post.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    const activeUrls = new Set(
      activePosts.map((p: { imageUrl: string | null }) => p.imageUrl).filter(Boolean)
    );

    // Helper to clean blobs under a prefix
    const cleanPrefix = async (prefix: string) => {
      let hasMore = true;
      let cursor: string | undefined;
      while (hasMore) {
        const listing = await list({ prefix, cursor });
        for (const blob of listing.blobs) {
          if (activeUrls.has(blob.url)) continue;
          if (blob.uploadedAt < cutoff) {
            try {
              await del(blob.url);
              deleted++;
              console.log(`[Cleanup] Deleted orphaned blob: ${blob.pathname}`);
            } catch (err) {
              console.error(`[Cleanup] Failed to delete orphaned blob:`, (err as Error).message);
              errors++;
            }
          }
        }
        hasMore = listing.hasMore;
        cursor = listing.cursor;
      }
    };

    // Clean up orphaned generated images
    await cleanPrefix("generated/");
    // Clean up orphaned uploads
    await cleanPrefix("uploads/");
  } catch (err) {
    console.error("[Cleanup] Error cleaning orphaned blobs:", (err as Error).message);
    errors++;
  }

  return { deleted, errors };
}


