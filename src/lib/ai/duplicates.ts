export function normalizeTopicTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type DuplicateMatch = {
  title: string;
  existingTitle: string;
  normalized: string;
};

export function findDuplicateTitles(
  candidateTitles: string[],
  existingTitles: string[],
): DuplicateMatch[] {
  const existingMap = new Map<string, string>();
  for (const title of existingTitles) {
    const key = normalizeTopicTitle(title);
    if (key && !existingMap.has(key)) existingMap.set(key, title);
  }

  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  for (const title of candidateTitles) {
    const key = normalizeTopicTitle(title);
    if (!key || seen.has(key)) continue;
    const existingTitle = existingMap.get(key);
    if (existingTitle) {
      seen.add(key);
      matches.push({ title, existingTitle, normalized: key });
    }
  }

  return matches;
}

export function isDuplicateTitle(title: string, existingTitles: string[]): boolean {
  const key = normalizeTopicTitle(title);
  if (!key) return false;
  return existingTitles.some((t) => normalizeTopicTitle(t) === key);
}
