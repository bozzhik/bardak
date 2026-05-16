import {normalizeTagToken} from '@repo/shared'
import {mutation, query} from '@convex/_generated/server'
import type {MutationCtx} from '@convex/_generated/server'
import type {Id} from '@convex/_generated/dataModel'
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
