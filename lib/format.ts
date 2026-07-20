// Utilities to clean & format AI-generated post content for LinkedIn.
// LinkedIn renders plain text only - markdown markers like ** or __ show up
// literally, so they are stripped. List items get one blank line between them.

/** Strip markdown emphasis / heading / inline-code markers. */
export function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*\*([\s\S]*?)\*\*\*/g, "$1") // ***bold italic***
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1") // **bold**
    .replace(/__([\s\S]*?)__/g, "$1") // __bold__
    .replace(/`{1,3}([^`]+?)`{1,3}/g, "$1") // `code`
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // ## heading
    .replace(/[\u2014\u2013\u2015]/g, "-"); // em / en / bar (long) dashes -> a normal hyphen
}

/** Clean a single-line value such as the hook/title (no list handling). */
export function cleanInline(input: string | null | undefined): string {
  if (!input) return "";
  return stripMarkdown(input)
    .replace(/\*/g, "") // stray asterisks
    .replace(/\s+/g, " ") // collapse newlines/whitespace to single spaces
    .trim();
}

// Matches a bullet ("- ", "• ", "* ") or numbered ("1. ", "2) ") list item.
const LIST_RE = /^(\s*)(\d+[.)]|[-•*])\s+(.*)$/;

/**
 * Clean + format a post body for LinkedIn:
 * - removes markdown emphasis (**, __, ##, `, stray *)
 * - normalizes bullet markers to "•" (keeps numbered markers) and inserts ONE
 *   blank line beneath every list item
 * - preserves the user's intentional blank lines (up to two in a row), only
 *   collapsing runaway gaps of three or more blank lines
 */
export function formatPostBody(input: string | null | undefined): string {
  if (!input) return "";
  const lines = stripMarkdown(input).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LIST_RE);
    if (m) {
      const indent = m[1];
      const marker = /^\d/.test(m[2]) ? m[2] : "•"; // keep numbers, normalize bullets
      const content = m[3].replace(/\*/g, "").trim();
      out.push(`${indent}${marker} ${content}`);
      // one blank line under each list item (unless the next line is already blank)
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== "") out.push("");
    } else {
      out.push(lines[i].replace(/\*/g, ""));
    }
  }

  return out
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n") // keep up to two blank lines; cap only runaway gaps
    .trim();
}
