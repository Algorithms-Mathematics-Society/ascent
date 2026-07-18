export function buildSearchTerms(
  canonicalName: string,
  aliases: string[],
): string[] {
  const words = [canonicalName, ...aliases]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const terms = new Set<string>();
  for (const word of words) {
    for (let end = 2; end <= word.length; end++) {
      terms.add(word.slice(0, end));
    }
  }
  return Array.from(terms);
}
