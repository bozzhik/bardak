import {format} from 'date-fns'

import type {FieldMeta} from '@/lib/db/meta.generated'

export const DB_BOX = 'flex w-full mx-auto max-w-6xl flex-1 flex-col gap-6 px-6 py-10 sm:px-0 sm:py-3'

export function defaultValueForField(m: FieldMeta) {
  if (m.kind === 'boolean') return false
  if (m.kind === 'number' || m.kind === 'int64') return 0
  return ''
}

export function formatDbAdminCellValue(v: unknown) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return JSON.stringify(v)
}

export function humanizeTableSlug(slug: string) {
  if (!slug) return slug
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/** Convex `_creationTime` is a Unix time in milliseconds (may include decimal noise). */
export function formatConvexCreationTime(ts: unknown) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '—'
  const ms = Math.trunc(ts)
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss')
}

const SHORT_ID_HEAD = 7
const SHORT_ID_TAIL = 6

export function shortConvexDocumentId(
  id: string,
  opts?: {
    head?: number
    tail?: number
  },
) {
  const head = opts?.head ?? SHORT_ID_HEAD
  const tail = opts?.tail ?? SHORT_ID_TAIL
  if (head < 0 || tail < 0) return id
  if (id.length <= head + tail + 1) return id
  return `${id.slice(0, head)}…${id.slice(-tail)}`
}

export function coerceDbAdminFieldInput(kind: string, raw: string, checked?: boolean): unknown {
  if (kind === 'number') {
    if (raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  if (kind === 'boolean') return !!checked
  return raw
}
