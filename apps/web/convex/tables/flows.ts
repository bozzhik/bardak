import {normalizeTagToken} from '@repo/shared'
import {mutation, query} from '@convex/_generated/server'
import type {MutationCtx} from '@convex/_generated/server'
import type {Id} from '@convex/_generated/dataModel'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

async function ensureTag(ctx: MutationCtx, userId: Id<'users'>, rawTag: string, now: number): Promise<Id<'tags'> | null> {
  const tag = normalizeTagToken(rawTag)
  if (tag === null) return null

  const existing = await ctx.db
    .query('tags')
    .withIndex('by_userId_and_slug', (q) => q.eq('userId', userId).eq('slug', tag.slug))
    .unique()

  if (existing !== null) return existing._id

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

export const upsertActive = mutation({
  args: {
    userId: v.id('users'),
    chatId: v.number(),
    kind: v.literal('tag'),
    entryId: v.id('entries'),
  },
  returns: v.object({
    status: v.union(v.literal('created'), v.literal('replaced')),
    flowId: v.id('flows'),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('flows')
      .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', args.userId).eq('chatId', args.chatId).eq('status', 'active'))
      .unique()

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        kind: args.kind,
        entryId: args.entryId,
        step: 'tag',
        updatedAt: now,
      })

      return {
        status: 'replaced' as const,
        flowId: existing._id,
      }
    }

    const flowId = await ctx.db.insert('flows', {
      userId: args.userId,
      chatId: args.chatId,
      kind: args.kind,
      status: 'active',
      entryId: args.entryId,
      step: 'tag',
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
    })

    return {
      status: 'created' as const,
      flowId,
    }
  },
})

export const completeTag = mutation({
  args: {
    userId: v.id('users'),
    chatId: v.number(),
    tags: v.array(v.string()),
  },
  returns: v.union(
    v.object({status: v.literal('no_active')}),
    v.object({
      status: v.literal('invalid_tag'),
      flowId: v.id('flows'),
      entryId: v.id('entries'),
    }),
    v.object({
      status: v.literal('tagged'),
      flowId: v.id('flows'),
      entryId: v.id('entries'),
      tagIds: v.array(v.id('tags')),
    }),
  ),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query('flows')
      .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', args.userId).eq('chatId', args.chatId).eq('status', 'active'))
      .unique()

    if (active === null) return {status: 'no_active' as const}

    if (active.entryId === null) return {status: 'no_active' as const}

    const now = Date.now()
    const tagIds: Array<Id<'tags'>> = []
    const seenTagIds = new Set<Id<'tags'>>()

    for (const rawTag of args.tags) {
      const tagId = await ensureTag(ctx, args.userId, rawTag, now)
      if (tagId === null || seenTagIds.has(tagId)) continue
      seenTagIds.add(tagId)
      tagIds.push(tagId)
    }

    if (tagIds.length === 0) {
      return {
        status: 'invalid_tag' as const,
        flowId: active._id,
        entryId: active.entryId,
      }
    }

    for (const tagId of tagIds) {
      await linkTag(ctx, args.userId, active.entryId, tagId, now)
    }

    await ctx.db.patch(active.entryId, {
      status: 'saved',
      updatedAt: now,
    })
    await ctx.db.patch(active._id, {
      status: 'done',
      updatedAt: now,
    })

    return {
      status: 'tagged' as const,
      flowId: active._id,
      entryId: active.entryId,
      tagIds,
    }
  },
})

export const completeTagById = mutation({
  args: {
    userId: v.id('users'),
    chatId: v.number(),
    tagId: v.id('tags'),
  },
  returns: v.union(
    v.object({status: v.literal('no_active')}),
    v.object({status: v.literal('missing_tag')}),
    v.object({
      status: v.literal('tagged'),
      flowId: v.id('flows'),
      entryId: v.id('entries'),
      tagId: v.id('tags'),
      tagName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.tagId)
    if (tag === null || tag.userId !== args.userId) return {status: 'missing_tag' as const}

    const active = await ctx.db
      .query('flows')
      .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', args.userId).eq('chatId', args.chatId).eq('status', 'active'))
      .unique()

    if (active === null || active.entryId === null) return {status: 'no_active' as const}

    const now = Date.now()
    await linkTag(ctx, args.userId, active.entryId, args.tagId, now)
    await ctx.db.patch(active.entryId, {
      status: 'saved',
      updatedAt: now,
    })
    await ctx.db.patch(active._id, {
      status: 'done',
      updatedAt: now,
    })

    return {
      status: 'tagged' as const,
      flowId: active._id,
      entryId: active.entryId,
      tagId: args.tagId,
      tagName: tag.name,
    }
  },
})

export const cancelForEntry = mutation({
  args: {
    userId: v.id('users'),
    chatId: v.number(),
    entryId: v.id('entries'),
  },
  returns: v.union(
    v.object({status: v.literal('no_active')}),
    v.object({
      status: v.literal('cancelled'),
      flowId: v.id('flows'),
      entryId: v.id('entries'),
    }),
  ),
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query('flows')
      .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', args.userId).eq('chatId', args.chatId).eq('status', 'active'))
      .unique()

    if (active === null || active.entryId !== args.entryId) {
      return {status: 'no_active' as const}
    }

    await ctx.db.patch(active._id, {
      status: 'cancelled',
      updatedAt: Date.now(),
    })

    return {
      status: 'cancelled' as const,
      flowId: active._id,
      entryId: args.entryId,
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
    const rows = await ctx.db.query('flows').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('flows'),
        _creationTime: v.number(),
        userId: v.id('users'),
        chatId: v.number(),
        kind: v.literal('tag'),
        status: v.union(v.literal('active'), v.literal('done'), v.literal('cancelled')),
        entryId: v.union(v.id('entries'), v.null()),
        step: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
        expiresAt: v.union(v.number(), v.null()),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('flows').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('flows')},
  returns: v.union(
    v.object({
      _id: v.id('flows'),
      _creationTime: v.number(),
      userId: v.id('users'),
      chatId: v.number(),
      kind: v.literal('tag'),
      status: v.union(v.literal('active'), v.literal('done'), v.literal('cancelled')),
      entryId: v.union(v.id('entries'), v.null()),
      step: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.union(v.number(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('flows', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.id('users'),
      chatId: v.number(),
      kind: v.literal('tag'),
      status: v.union(v.literal('active'), v.literal('done'), v.literal('cancelled')),
      entryId: v.union(v.id('entries'), v.null()),
      step: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      expiresAt: v.union(v.number(), v.null()),
    }),
  },
  returns: v.id('flows'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('flows', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('flows'),
    patch: v.object({
      userId: v.optional(v.id('users')),
      chatId: v.optional(v.number()),
      kind: v.optional(v.literal('tag')),
      status: v.optional(v.union(v.literal('active'), v.literal('done'), v.literal('cancelled'))),
      entryId: v.optional(v.union(v.id('entries'), v.null())),
      step: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      expiresAt: v.optional(v.union(v.number(), v.null())),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('flows', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('flows')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
