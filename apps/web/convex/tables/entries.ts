import {normalizeTagToken} from '@repo/shared'
import {mutation, query} from '@convex/_generated/server'
import type {MutationCtx, QueryCtx} from '@convex/_generated/server'
import type {Doc, Id} from '@convex/_generated/dataModel'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

const nullableString = v.union(v.string(), v.null())
const nullableNumber = v.union(v.number(), v.null())
const kind = v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported'))
const entryStatus = v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived'))
const descriptionSource = v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai'))

const context = v.object({
  forwardOrigin: nullableString,
  forwardDate: nullableNumber,
  replyToMessageId: nullableNumber,
})

const file = v.object({
  fileId: nullableString,
  fileUniqueId: nullableString,
  fileName: nullableString,
  mimeType: nullableString,
  fileSize: nullableNumber,
  duration: nullableNumber,
  width: nullableNumber,
  height: nullableNumber,
  emoji: nullableString,
  setName: nullableString,
  isAnimated: v.union(v.boolean(), v.null()),
  isVideo: v.union(v.boolean(), v.null()),
})

const telegram = v.object({
  type: v.string(),
  context,
  file,
})

const emptyContext = {
  forwardOrigin: null,
  forwardDate: null,
  replyToMessageId: null,
}

const emptyFile = {
  fileId: null,
  fileUniqueId: null,
  fileName: null,
  mimeType: null,
  fileSize: null,
  duration: null,
  width: null,
  height: null,
  emoji: null,
  setName: null,
  isAnimated: null,
  isVideo: null,
}

function createDefaultTelegram(kind: string) {
  return {
    type: `message:${kind}`,
    context: emptyContext,
    file: emptyFile,
  }
}

async function getTagIdsForEntry(ctx: MutationCtx, userId: Id<'users'>, entryId: Id<'entries'>): Promise<Array<Id<'tags'>>> {
  const links = await ctx.db
    .query('entryTags')
    .withIndex('by_userId_and_entryId', (q) => q.eq('userId', userId).eq('entryId', entryId))
    .take(100)

  return links.map((link) => link.tagId)
}

async function getTagNamesForEntry(ctx: QueryCtx, userId: Id<'users'>, entryId: Id<'entries'>): Promise<string[]> {
  const links = await ctx.db
    .query('entryTags')
    .withIndex('by_userId_and_entryId', (q) => q.eq('userId', userId).eq('entryId', entryId))
    .take(100)

  const tags = await Promise.all(links.map((link) => ctx.db.get(link.tagId)))
  return tags.flatMap((tag) => (tag === null ? [] : [tag.name]))
}

async function ensureTag(ctx: MutationCtx, userId: Id<'users'>, rawTag: string, now: number): Promise<Id<'tags'> | null> {
  const tag = normalizeTagToken(rawTag)
  if (tag === null) return null

  const existing = await ctx.db
    .query('tags')
    .withIndex('by_userId_and_slug', (q) => q.eq('userId', userId).eq('slug', tag.slug))
    .unique()

  if (existing !== null) {
    return existing._id
  }

  return await ctx.db.insert('tags', {
    userId,
    name: tag.name,
    slug: tag.slug,
    createdAt: now,
    updatedAt: now,
  })
}

async function linkTag(ctx: MutationCtx, userId: Id<'users'>, entryId: Id<'entries'>, tagId: Id<'tags'>, now: number): Promise<void> {
  const existing = await ctx.db
    .query('entryTags')
    .withIndex('by_userId_and_entryId_and_tagId', (q) => q.eq('userId', userId).eq('entryId', entryId).eq('tagId', tagId))
    .unique()

  if (existing !== null) return

  await ctx.db.insert('entryTags', {
    userId,
    entryId,
    tagId,
    createdAt: now,
  })
}

export const save = mutation({
  args: {
    userId: v.id('users'),
    sourceChatId: v.number(),
    sourceMessageId: v.number(),
    kind,
    text: nullableString,
    description: nullableString,
    descriptionSource: v.optional(descriptionSource),
    url: nullableString,
    tags: v.array(v.string()),
    telegram: v.optional(telegram),
  },
  returns: v.object({
    status: v.union(v.literal('created'), v.literal('duplicate')),
    entryId: v.id('entries'),
    entryStatus,
    tagIds: v.array(v.id('tags')),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('entries')
      .withIndex('by_userId_and_sourceChatId_and_sourceMessageId', (q) => q.eq('userId', args.userId).eq('sourceChatId', args.sourceChatId).eq('sourceMessageId', args.sourceMessageId))
      .unique()

    if (existing !== null) {
      return {
        status: 'duplicate' as const,
        entryId: existing._id,
        entryStatus: existing.status,
        tagIds: await getTagIdsForEntry(ctx, args.userId, existing._id),
      }
    }

    const now = Date.now()
    const tagIds: Array<Id<'tags'>> = []
    const seenTagIds = new Set<Id<'tags'>>()

    for (const rawTag of args.tags) {
      const tagId = await ensureTag(ctx, args.userId, rawTag, now)
      if (tagId === null || seenTagIds.has(tagId)) continue
      seenTagIds.add(tagId)
      tagIds.push(tagId)
    }

    const status: 'inbox' | 'saved' = tagIds.length > 0 ? 'saved' : 'inbox'
    const entryId = await ctx.db.insert('entries', {
      userId: args.userId,
      source: 'telegram',
      sourceChatId: args.sourceChatId,
      sourceMessageId: args.sourceMessageId,
      kind: args.kind,
      status,
      text: args.text,
      description: args.description,
      descriptionSource: args.descriptionSource ?? (args.text === null && args.description === null ? 'none' : args.description !== null ? 'user' : 'text'),
      url: args.url,
      telegram: args.telegram ?? createDefaultTelegram(args.kind),
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    })

    for (const tagId of tagIds) {
      await linkTag(ctx, args.userId, entryId, tagId, now)
    }

    return {
      status: 'created' as const,
      entryId,
      entryStatus: status,
      tagIds,
    }
  },
})

async function replaceEntryTags(ctx: MutationCtx, userId: Id<'users'>, entryId: Id<'entries'>, tags: string[], now: number): Promise<Array<Id<'tags'>>> {
  const existingLinks = await ctx.db
    .query('entryTags')
    .withIndex('by_userId_and_entryId', (q) => q.eq('userId', userId).eq('entryId', entryId))
    .take(1000)

  for (const link of existingLinks) {
    await ctx.db.delete(link._id)
  }

  const tagIds: Array<Id<'tags'>> = []
  const seenTagIds = new Set<Id<'tags'>>()
  for (const rawTag of tags) {
    const tagId = await ensureTag(ctx, userId, rawTag, now)
    if (tagId === null || seenTagIds.has(tagId)) continue
    seenTagIds.add(tagId)
    tagIds.push(tagId)
    await linkTag(ctx, userId, entryId, tagId, now)
  }

  return tagIds
}

export const updateFromTelegramEdit = mutation({
  args: {
    userId: v.id('users'),
    sourceChatId: v.number(),
    sourceMessageId: v.number(),
    kind,
    text: nullableString,
    description: nullableString,
    descriptionSource: v.optional(descriptionSource),
    url: nullableString,
    tags: v.array(v.string()),
    telegram: v.optional(telegram),
  },
  returns: v.union(
    v.object({status: v.literal('no_existing')}),
    v.object({
      status: v.literal('updated'),
      entryId: v.id('entries'),
      entryStatus,
      tagIds: v.array(v.id('tags')),
    }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('entries')
      .withIndex('by_userId_and_sourceChatId_and_sourceMessageId', (q) => q.eq('userId', args.userId).eq('sourceChatId', args.sourceChatId).eq('sourceMessageId', args.sourceMessageId))
      .unique()

    if (existing === null) return {status: 'no_existing' as const}

    const now = Date.now()
    const tagIds = await replaceEntryTags(ctx, args.userId, existing._id, args.tags, now)
    const nextStatus: 'inbox' | 'saved' | 'archived' = existing.status === 'archived' ? 'archived' : tagIds.length > 0 ? 'saved' : 'inbox'

    await ctx.db.patch(existing._id, {
      kind: args.kind,
      status: nextStatus,
      text: args.text,
      description: args.description,
      descriptionSource: args.descriptionSource ?? (args.text === null && args.description === null ? 'none' : args.description !== null ? 'user' : 'text'),
      url: args.url,
      telegram: args.telegram ?? existing.telegram,
      updatedAt: now,
    })

    return {
      status: 'updated' as const,
      entryId: existing._id,
      entryStatus: nextStatus,
      tagIds,
    }
  },
})

export const archiveBySourceMessage = mutation({
  args: {
    userId: v.id('users'),
    sourceChatId: v.number(),
    sourceMessageId: v.number(),
  },
  returns: v.union(
    v.object({status: v.literal('missing')}),
    v.object({
      status: v.literal('archived'),
      entryId: v.id('entries'),
    }),
  ),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('entries')
      .withIndex('by_userId_and_sourceChatId_and_sourceMessageId', (q) => q.eq('userId', args.userId).eq('sourceChatId', args.sourceChatId).eq('sourceMessageId', args.sourceMessageId))
      .unique()

    if (existing === null) return {status: 'missing' as const}

    const now = Date.now()
    await ctx.db.patch(existing._id, {
      status: 'archived',
      archivedAt: existing.archivedAt ?? now,
      updatedAt: now,
    })

    const active = await ctx.db
      .query('flows')
      .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', args.userId).eq('chatId', args.sourceChatId).eq('status', 'active'))
      .unique()

    if (active !== null && active.entryId === existing._id) {
      await ctx.db.patch(active._id, {
        status: 'cancelled',
        updatedAt: now,
      })
    }

    return {
      status: 'archived' as const,
      entryId: existing._id,
    }
  },
})

export const getInboxItem = query({
  args: {
    userId: v.id('users'),
    entryId: v.id('entries'),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id('entries'),
      _creationTime: v.number(),
      userId: v.id('users'),
      source: v.literal('telegram'),
      sourceChatId: v.number(),
      sourceMessageId: v.number(),
      kind,
      status: v.literal('inbox'),
      text: nullableString,
      description: nullableString,
      descriptionSource,
      url: nullableString,
      telegram,
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: nullableNumber,
    }),
  ),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.entryId)
    if (item === null || item.userId !== args.userId || item.status !== 'inbox') return null
    return {...item, status: 'inbox' as const}
  },
})

export const countInbox = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    count: v.number(),
    isTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 1000)
    const rows = await ctx.db
      .query('entries')
      .withIndex('by_userId_and_status_and_createdAt', (q) => q.eq('userId', args.userId).eq('status', 'inbox'))
      .take(limit + 1)

    return {
      count: Math.min(rows.length, limit),
      isTruncated: rows.length > limit,
    }
  },
})

export const getNextInbox = query({
  args: {
    userId: v.id('users'),
  },
  returns: v.union(
    v.object({status: v.literal('empty')}),
    v.object({
      status: v.literal('found'),
      entry: v.object({
        id: v.id('entries'),
        kind,
        text: nullableString,
        description: nullableString,
        url: nullableString,
        createdAt: v.number(),
      }),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('entries')
      .withIndex('by_userId_and_status_and_createdAt', (q) => q.eq('userId', args.userId).eq('status', 'inbox'))
      .order('asc')
      .take(1)
    const entry = rows[0]

    if (entry === undefined) return {status: 'empty' as const}

    return {
      status: 'found' as const,
      entry: {
        id: entry._id,
        kind: entry.kind,
        text: entry.text,
        description: entry.description,
        url: entry.url,
        createdAt: entry.createdAt,
      },
    }
  },
})

function searchTextForEntry(entry: Doc<'entries'>): string {
  return [entry.text, entry.description, entry.url, entry.telegram.file.fileName, entry.telegram.file.mimeType, entry.telegram.context.forwardOrigin]
    .filter((value): value is string => value !== null)
    .join(' ')
    .toLocaleLowerCase()
}

function entryMatchesText(entry: Doc<'entries'>, text: string | null): boolean {
  if (text === null) return true
  return searchTextForEntry(entry).includes(text)
}

export const search = query({
  args: {
    userId: v.id('users'),
    text: v.optional(nullableString),
    tags: v.optional(v.array(v.string())),
    kind: v.optional(v.union(kind, v.null())),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        id: v.id('entries'),
        kind,
        status: v.union(v.literal('inbox'), v.literal('saved')),
        text: nullableString,
        description: nullableString,
        url: nullableString,
        createdAt: v.number(),
        tags: v.array(v.string()),
      }),
    ),
    isTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 5, 1), 20)
    const scanLimit = Math.min(Math.max(limit * 20, 50), 500)
    const text = args.text?.trim().toLocaleLowerCase() ?? null
    const kindFilter = args.kind ?? null
    const tagSlugs: string[] = []
    const seenTags = new Set<string>()

    for (const rawTag of args.tags ?? []) {
      const tag = normalizeTagToken(rawTag)
      if (tag === null) return {items: [], isTruncated: false}
      if (seenTags.has(tag.slug)) continue
      seenTags.add(tag.slug)
      tagSlugs.push(tag.slug)
    }

    if ((text === null || text.length === 0) && kindFilter === null && tagSlugs.length === 0) {
      return {items: [], isTruncated: false}
    }

    let candidates: Doc<'entries'>[] = []
    if (tagSlugs.length > 0) {
      const firstTag = await ctx.db
        .query('tags')
        .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', tagSlugs[0]!))
        .unique()

      if (firstTag === null) return {items: [], isTruncated: false}

      const links = await ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_tagId', (q) => q.eq('userId', args.userId).eq('tagId', firstTag._id))
        .order('desc')
        .take(scanLimit)

      const rows = await Promise.all(links.map((link) => ctx.db.get(link.entryId)))
      candidates = rows.filter((entry): entry is Doc<'entries'> => entry !== null).sort((left, right) => right.createdAt - left.createdAt)
    } else if (kindFilter !== null) {
      candidates = await ctx.db
        .query('entries')
        .withIndex('by_userId_and_kind', (q) => q.eq('userId', args.userId).eq('kind', kindFilter))
        .order('desc')
        .take(scanLimit)
    } else {
      candidates = await ctx.db
        .query('entries')
        .withIndex('by_userId_and_createdAt', (q) => q.eq('userId', args.userId))
        .order('desc')
        .take(scanLimit)
    }

    const items = []
    for (const entry of candidates) {
      if (entry.userId !== args.userId || entry.status === 'archived') continue
      if (kindFilter !== null && entry.kind !== kindFilter) continue
      if (!entryMatchesText(entry, text === null || text.length === 0 ? null : text)) continue

      const entryTags = await getTagNamesForEntry(ctx, args.userId, entry._id)
      if (tagSlugs.some((tag) => !entryTags.includes(tag))) continue

      items.push({
        id: entry._id,
        kind: entry.kind,
        status: entry.status,
        text: entry.text,
        description: entry.description,
        url: entry.url,
        createdAt: entry.createdAt,
        tags: entryTags,
      })

      if (items.length > limit) break
    }

    return {
      items: items.slice(0, limit),
      isTruncated: items.length > limit,
    }
  },
})

// ! DO NOT UPDATE MANNUALLY THIS PART – it's generated by the script `scripts/gen-db-meta.mjs`
// db-gen:base:start
export const length = query({
  args: {},
  returns: v.object({
    count: v.number(),
    isTruncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query('entries').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('entries'),
        _creationTime: v.number(),
        userId: v.id('users'),
        source: v.literal('telegram'),
        sourceChatId: v.number(),
        sourceMessageId: v.number(),
        kind: v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported')),
        status: v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived')),
        text: v.union(v.string(), v.null()),
        description: v.union(v.string(), v.null()),
        descriptionSource: v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai')),
        url: v.union(v.string(), v.null()),
        telegram: v.object({
          type: v.string(),
          context: v.object({
            forwardOrigin: v.union(v.string(), v.null()),
            forwardDate: v.union(v.number(), v.null()),
            replyToMessageId: v.union(v.number(), v.null()),
          }),
          file: v.object({
            fileId: v.union(v.string(), v.null()),
            fileUniqueId: v.union(v.string(), v.null()),
            fileName: v.union(v.string(), v.null()),
            mimeType: v.union(v.string(), v.null()),
            fileSize: v.union(v.number(), v.null()),
            duration: v.union(v.number(), v.null()),
            width: v.union(v.number(), v.null()),
            height: v.union(v.number(), v.null()),
            emoji: v.union(v.string(), v.null()),
            setName: v.union(v.string(), v.null()),
            isAnimated: v.union(v.boolean(), v.null()),
            isVideo: v.union(v.boolean(), v.null()),
          }),
        }),
        createdAt: v.number(),
        updatedAt: v.number(),
        archivedAt: v.union(v.number(), v.null()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('entries').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('entries')},
  returns: v.union(
    v.object({
      _id: v.id('entries'),
      _creationTime: v.number(),
      userId: v.id('users'),
      source: v.literal('telegram'),
      sourceChatId: v.number(),
      sourceMessageId: v.number(),
      kind: v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported')),
      status: v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived')),
      text: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      descriptionSource: v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai')),
      url: v.union(v.string(), v.null()),
      telegram: v.object({
        type: v.string(),
        context: v.object({
          forwardOrigin: v.union(v.string(), v.null()),
          forwardDate: v.union(v.number(), v.null()),
          replyToMessageId: v.union(v.number(), v.null()),
        }),
        file: v.object({
          fileId: v.union(v.string(), v.null()),
          fileUniqueId: v.union(v.string(), v.null()),
          fileName: v.union(v.string(), v.null()),
          mimeType: v.union(v.string(), v.null()),
          fileSize: v.union(v.number(), v.null()),
          duration: v.union(v.number(), v.null()),
          width: v.union(v.number(), v.null()),
          height: v.union(v.number(), v.null()),
          emoji: v.union(v.string(), v.null()),
          setName: v.union(v.string(), v.null()),
          isAnimated: v.union(v.boolean(), v.null()),
          isVideo: v.union(v.boolean(), v.null()),
        }),
      }),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('entries', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.id('users'),
      source: v.literal('telegram'),
      sourceChatId: v.number(),
      sourceMessageId: v.number(),
      kind: v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported')),
      status: v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived')),
      text: v.union(v.string(), v.null()),
      description: v.union(v.string(), v.null()),
      descriptionSource: v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai')),
      url: v.union(v.string(), v.null()),
      telegram: v.object({
        type: v.string(),
        context: v.object({
          forwardOrigin: v.union(v.string(), v.null()),
          forwardDate: v.union(v.number(), v.null()),
          replyToMessageId: v.union(v.number(), v.null()),
        }),
        file: v.object({
          fileId: v.union(v.string(), v.null()),
          fileUniqueId: v.union(v.string(), v.null()),
          fileName: v.union(v.string(), v.null()),
          mimeType: v.union(v.string(), v.null()),
          fileSize: v.union(v.number(), v.null()),
          duration: v.union(v.number(), v.null()),
          width: v.union(v.number(), v.null()),
          height: v.union(v.number(), v.null()),
          emoji: v.union(v.string(), v.null()),
          setName: v.union(v.string(), v.null()),
          isAnimated: v.union(v.boolean(), v.null()),
          isVideo: v.union(v.boolean(), v.null()),
        }),
      }),
      createdAt: v.number(),
      updatedAt: v.number(),
      archivedAt: v.union(v.number(), v.null()),
    }),
  },
  returns: v.id('entries'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('entries', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('entries'),
    patch: v.object({
      userId: v.optional(v.id('users')),
      source: v.optional(v.literal('telegram')),
      sourceChatId: v.optional(v.number()),
      sourceMessageId: v.optional(v.number()),
      kind: v.optional(v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported'))),
      status: v.optional(v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived'))),
      text: v.optional(v.union(v.string(), v.null())),
      description: v.optional(v.union(v.string(), v.null())),
      descriptionSource: v.optional(v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai'))),
      url: v.optional(v.union(v.string(), v.null())),
      telegram: v.optional(
        v.object({
          type: v.string(),
          context: v.object({
            forwardOrigin: v.union(v.string(), v.null()),
            forwardDate: v.union(v.number(), v.null()),
            replyToMessageId: v.union(v.number(), v.null()),
          }),
          file: v.object({
            fileId: v.union(v.string(), v.null()),
            fileUniqueId: v.union(v.string(), v.null()),
            fileName: v.union(v.string(), v.null()),
            mimeType: v.union(v.string(), v.null()),
            fileSize: v.union(v.number(), v.null()),
            duration: v.union(v.number(), v.null()),
            width: v.union(v.number(), v.null()),
            height: v.union(v.number(), v.null()),
            emoji: v.union(v.string(), v.null()),
            setName: v.union(v.string(), v.null()),
            isAnimated: v.union(v.boolean(), v.null()),
            isVideo: v.union(v.boolean(), v.null()),
          }),
        }),
      ),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      archivedAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('entries', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('entries')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
