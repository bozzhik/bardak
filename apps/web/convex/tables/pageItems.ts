import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

import {mutation, query} from '@convex/_generated/server'

// db-gen:base:start
export const length = query({
  args: {},
  returns: v.object({
    count: v.number(),
    isTruncated: v.boolean(),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query('pageItems').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('pageItems'),
        _creationTime: v.number(),
        userId: v.id('users'),
        pageId: v.id('pages'),
        entryId: v.id('entries'),
        status: v.union(v.literal('visible'), v.literal('hidden')),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('pageItems').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('pageItems')},
  returns: v.union(
    v.object({
      _id: v.id('pageItems'),
      _creationTime: v.number(),
      userId: v.id('users'),
      pageId: v.id('pages'),
      entryId: v.id('entries'),
      status: v.union(v.literal('visible'), v.literal('hidden')),
      position: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('pageItems', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.id('users'),
      pageId: v.id('pages'),
      entryId: v.id('entries'),
      status: v.union(v.literal('visible'), v.literal('hidden')),
      position: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  },
  returns: v.id('pageItems'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('pageItems', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('pageItems'),
    patch: v.object({
      userId: v.optional(v.id('users')),
      pageId: v.optional(v.id('pages')),
      entryId: v.optional(v.id('entries')),
      status: v.optional(v.union(v.literal('visible'), v.literal('hidden'))),
      position: v.optional(v.number()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('pageItems', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('pageItems')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
