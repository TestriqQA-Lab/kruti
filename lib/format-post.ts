/**
 * formatPostBody — tidies a generated LinkedIn post body so it reads cleanly
 * on both web and mobile. Applied server-side at generation time so the
 * stored body is already clean (no client-only formatting drift).
 *
 *  • Strips stray Markdown asterisks (no **bold**, no "* " bullets).
 *  • Ensures a blank line after every numbered / bulleted item.
 *  • Keeps the opening hook directly above the body — NO blank line under it.
 *  • Collapses 3+ consecutive blank lines down to one and trims.
 */
export function formatPostBody(raw: string): string {
  if (!raw) return raw;

  // Strip Markdown asterisks (both "* " bullets and **bold**).
  raw = raw.replace(/^[ \t]*\*+[ \t]*/gm, "").replace(/\*+/g, "");

  // Right-trim every line so trailing spaces never create phantom gaps.
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""));

  const listRe = /^\s*(?:[-*•]|\d+[.)])\s+/;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const next = lines[i + 1];
    // Blank line after a list item (unless the next line is already blank).
    if (listRe.test(lines[i]) && next !== undefined && next.trim() !== "") {
      out.push("");
    }
  }

  let result = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  // Hook directly above the body — remove any blank line under the first line.
  const nl = result.indexOf("\n");
  if (nl !== -1) {
    const hook = result.slice(0, nl);
    const rest = result.slice(nl + 1).replace(/^\n+/, "");
    if (rest) result = `${hook}\n${rest}`;
  }

  return result;
}
