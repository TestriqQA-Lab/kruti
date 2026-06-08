// Utilities to clean & format AI-generated post content for LinkedIn.
// LinkedIn renders plain text only — markdown markers like ** or __ show up
// literally, so they are stripped. List items get one blank line between them.

/** Strip markdown emphasis / heading / inline-code markers. */
export function stripMarkdown(input: string): string {
  return input
    .replace(/\*\*\*([\s\S]*?)\*\*\*/g, "$1") // ***bold italic***
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1") // **bold**
    .replace(/__([\s\S]*?)__/g, "$1") // __bold__
    .replace(/`{1,3}([^`]+?)`{1,3}/g, "$1") // `code`
    .replace(/^\s{0,3}#{1,6}\s+/gm, ""); // ## heading
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
 * - collapses 3+ consecutive newlines into a single blank line
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
    .replace(/\n{3,}/g, "\n\n") // at most one blank line between blocks
    .trim();
}
