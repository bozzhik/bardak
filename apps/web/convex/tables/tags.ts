import {normalizeTagToken} from '@repo/shared'
import {mutation, query} from '@convex/_generated/server'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

export const ensure = mutation({
  args: {
    userId: v.id('users'),
    tag: v.string(),
  },
  returns: v.union(v.object({status: v.literal('created'), tagId: v.id('tags')}), v.object({status: v.literal('existing'), tagId: v.id('tags')}), v.object({status: v.literal('invalid')})),
  handler: async (ctx, args) => {
    const tag = normalizeTagToken(args.tag)
    if (tag === null) return {status: 'invalid' as const}

    const existing = await ctx.db
      .query('tags')
      .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', tag.slug))
      .unique()

    if (existing !== null) {
      return {status: 'existing' as const, tagId: existing._id}
    }

    const now = Date.now()
    const tagId = await ctx.db.insert('tags', {
      userId: args.userId,
      name: tag.name,
      slug: tag.slug,
      createdAt: now,
      updatedAt: now,
    })

    return {status: 'created' as const, tagId}
  },
})

export const listByUser = query({
  args: {
    userId: v.id('users'),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('tags'),
      _creationTime: v.number(),
      userId: v.id('users'),
      name: v.string(),
      slug: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query('tags')
      .withIndex('by_userId_and_createdAt', (q) => q.eq('userId', args.userId))
      .order('desc')
      .take(args.limit ?? 50)
  },
})

export const findBySlug = query({
  args: {
    userId: v.id('users'),
    tag: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal('found'),
      tag: v.object({
        id: v.id('tags'),
        name: v.string(),
        slug: v.string(),
      }),
    }),
    v.object({status: v.literal('missing')}),
    v.object({status: v.literal('invalid')}),
  ),
  handler: async (ctx, args) => {
    const tag = normalizeTagToken(args.tag)
    if (tag === null) return {status: 'invalid' as const}

    const existing = await ctx.db
      .query('tags')
      .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', tag.slug))
      .unique()

    if (existing === null) return {status: 'missing' as const}

    return {
      status: 'found' as const,
      tag: {
        id: existing._id,
        name: existing.name,
        slug: existing.slug,
      },
    }
  },
})

export const rename = mutation({
  args: {
    userId: v.id('users'),
    fromTag: v.string(),
    toTag: v.string(),
  },
  returns: v.union(
    v.object({
      status: v.literal('renamed'),
      tagId: v.id('tags'),
      name: v.string(),
      slug: v.string(),
    }),
    v.object({status: v.literal('source_missing')}),
    v.object({status: v.literal('target_exists')}),
    v.object({status: v.literal('invalid')}),
  ),
  handler: async (ctx, args) => {
    const fromTag = normalizeTagToken(args.fromTag)
    const toTag = normalizeTagToken(args.toTag)
    if (fromTag === null || toTag === null) return {status: 'invalid' as const}

    const source = await ctx.db
      .query('tags')
      .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', fromTag.slug))
      .unique()

    if (source === null) return {status: 'source_missing' as const}

    const target = await ctx.db
      .query('tags')
      .withIndex('by_userId_and_slug', (q) => q.eq('userId', args.userId).eq('slug', toTag.slug))
      .unique()

    if (target !== null && target._id !== source._id) return {status: 'target_exists' as const}

    await ctx.db.patch(source._id, {
      name: toTag.name,
      slug: toTag.slug,
      updatedAt: Date.now(),
    })

    return {
      status: 'renamed' as const,
      tagId: source._id,
      name: toTag.name,
      slug: toTag.slug,
    }
  },
})

export const removeForUser = mutation({
  args: {
    userId: v.id('users'),
    tagId: v.id('tags'),
  },
  returns: v.union(
    v.object({
      status: v.literal('deleted'),
      tagName: v.string(),
      linkCount: v.number(),
    }),
    v.object({status: v.literal('missing')}),
  ),
  handler: async (ctx, args) => {
    const tag = await ctx.db.get(args.tagId)
    if (tag === null || tag.userId !== args.userId) return {status: 'missing' as const}

    const links = await ctx.db
      .query('entryTags')
      .withIndex('by_userId_and_tagId', (q) => q.eq('userId', args.userId).eq('tagId', args.tagId))
      .take(1000)

    for (const link of links) {
      await ctx.db.delete(link._id)
      const remainingLinks = await ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_entryId', (q) => q.eq('userId', args.userId).eq('entryId', link.entryId))
        .take(1)
      const entry = await ctx.db.get(link.entryId)
      if (entry !== null && entry.status !== 'archived' && remainingLinks.length === 0) {
        await ctx.db.patch(entry._id, {
          status: 'inbox',
          updatedAt: Date.now(),
        })
      }
    }
    await ctx.db.delete(args.tagId)

    return {
      status: 'deleted' as const,
      tagName: tag.name,
      linkCount: links.length,
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
    const rows = await ctx.db.query('tags').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('tags'),
        _creationTime: v.number(),
        userId: v.id('users'),
        name: v.string(),
        slug: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('tags').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('tags')},
  returns: v.union(
    v.object({
      _id: v.id('tags'),
      _creationTime: v.number(),
      userId: v.id('users'),
      name: v.string(),
      slug: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('tags', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.id('users'),
      name: v.string(),
      slug: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
  returns: v.id('tags'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('tags', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('tags'),
    patch: v.object({
      userId: v.optional(v.id('users')),
      name: v.optional(v.string()),
      slug: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('tags', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('tags')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
