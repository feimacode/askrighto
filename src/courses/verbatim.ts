/**
 * Verbatim-run check: our curated text must be written in our own words, so it must not share a run of
 * 12 or more consecutive words with the official page it summarises (docs/course-data.md).
 */
export const VERBATIM_RUN_WORDS = 12;

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&amp;|&#\d+;/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** The first run of `min` or more words that `ours` shares with `page` (HTML or text), or undefined. */
export function sharedRun(
  ours: string,
  page: string,
  min = VERBATIM_RUN_WORDS,
): string | undefined {
  const a = words(ours);
  const b = words(page);
  if (a.length < min || b.length < min) return undefined;
  const grams = new Set<string>();
  for (let i = 0; i + min <= b.length; i++)
    grams.add(b.slice(i, i + min).join(" "));
  for (let i = 0; i + min <= a.length; i++) {
    const g = a.slice(i, i + min).join(" ");
    if (grams.has(g)) return g;
  }
  return undefined;
}
