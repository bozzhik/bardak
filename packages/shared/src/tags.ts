export type NormalizedTag = {
  name: string
  slug: string
}

const TAG_TOKEN_RE = /^#[\p{L}\p{N}_]+$/u

export function normalizeTagToken(raw: string): NormalizedTag | null {
  const token = raw.trim()
  if (!TAG_TOKEN_RE.test(token)) return null

  const value = token.slice(1).toLocaleLowerCase()
  return {
    name: value,
    slug: value,
  }
}
