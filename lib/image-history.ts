// Persistent per-post history of generated/uploaded images so the user can
// always get a previous result back — even after a reload or after the per-post
// generation limit is exhausted. Stored on Post.imageHistory as a JSON string.
//
// Shape: string[][] — an array of "generations". Each generation is a list of
// image URLs: length 1 = a single image / upload, length > 1 = a carousel set.

const MAX_GENERATIONS = 24;

/** Parse the stored JSON into a clean array of URL-groups. Tolerant of bad data. */
export function parseImageHistory(raw: string | null | undefined): string[][] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((g): string[] => {
        if (Array.isArray(g)) return g.filter((u): u is string => typeof u === "string" && u.length > 0);
        if (typeof g === "string" && g.length > 0) return [g];
        return [];
      })
      .filter((g) => g.length > 0);
  } catch {
    return [];
  }
}

/**
 * Append one generation (single image = [url], carousel = [u1, u2, ...]) to the
 * existing history and return the new JSON string. Skips a no-op append when the
 * new group is identical to the most recent one, and caps the total length.
 */
export function appendImageHistory(raw: string | null | undefined, urls: string[]): string {
  const group = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
  const history = parseImageHistory(raw);
  if (group.length === 0) return JSON.stringify(history);

  const last = history[history.length - 1];
  const isDuplicate =
    last && last.length === group.length && last.every((u, i) => u === group[i]);
  if (!isDuplicate) history.push(group);

  return JSON.stringify(history.slice(-MAX_GENERATIONS));
}
