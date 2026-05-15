export type NormalizedTag = {
  name: string
  slug: string
}

const TAG_TOKEN_RE = /^#[\p{L}\p{N}_]+$/u
const INLINE_TAG_RE = /(^|[^\p{L}\p{N}_])(?<tag>#[\p{L}\p{N}_]+)/gu

export function normalizeTagToken(raw: string): NormalizedTag | null {
  const token = raw.trim()
  if (!TAG_TOKEN_RE.test(token)) return null

  const value = token.slice(1).toLocaleLowerCase()
  return {
    name: value,
    slug: value,
  }
}

export function extractTagTokens(text: string): string[] {
  const tags: string[] = []
  const seenSlugs = new Set<string>()

  for (const match of text.matchAll(INLINE_TAG_RE)) {
    const token = match.groups?.tag
    if (token === undefined) continue

    const normalized = normalizeTagToken(token)
    if (normalized === null || seenSlugs.has(normalized.slug)) continue

    seenSlugs.add(normalized.slug)
    tags.push(token)
  }

  return tags
}
