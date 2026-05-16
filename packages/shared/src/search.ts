import {normalizeTagToken} from './tags.js'

export const ENTRY_KINDS = ['text', 'link', 'photo', 'voice', 'audio', 'document', 'video', 'sticker', 'unsupported'] as const

export type EntryKind = (typeof ENTRY_KINDS)[number]

export type SearchCriteria = {
  text: string | null
  tags: string[]
  kind: EntryKind | null
}

export type ParseSearchInputResult = {status: 'ok'; criteria: SearchCriteria} | {status: 'empty'} | {status: 'invalid_kind'; kind: string}

const KIND_PREFIX_RE = /^(?:type|kind):(.+)$/i
const KIND_ALIASES: Record<string, EntryKind> = {
  text: 'text',
  link: 'link',
  photo: 'photo',
  image: 'photo',
  voice: 'voice',
  audio: 'audio',
  document: 'document',
  doc: 'document',
  file: 'document',
  video: 'video',
  sticker: 'sticker',
  unsupported: 'unsupported',
}

export function parseSearchInput(input: string): ParseSearchInputResult {
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return {status: 'empty'}

  const textTokens: string[] = []
  const tags: string[] = []
  const seenTags = new Set<string>()
  let kind: EntryKind | null = null

  for (const token of tokens) {
    const kindMatch = token.match(KIND_PREFIX_RE)
    if (kindMatch !== null) {
      const rawKind = kindMatch[1]?.toLocaleLowerCase() ?? ''
      const parsedKind = KIND_ALIASES[rawKind]
      if (parsedKind === undefined) return {status: 'invalid_kind', kind: rawKind}
      kind = parsedKind
      continue
    }

    const tag = normalizeTagToken(token)
    if (tag !== null) {
      if (!seenTags.has(tag.slug)) {
        seenTags.add(tag.slug)
        tags.push(`#${tag.name}`)
      }
      continue
    }

    textTokens.push(token)
  }

  const text = textTokens.join(' ').trim()
  if (text.length === 0 && tags.length === 0 && kind === null) return {status: 'empty'}

  return {
    status: 'ok',
    criteria: {
      text: text.length === 0 ? null : text,
      tags,
      kind,
    },
  }
}
