import {mutation, query} from '@convex/_generated/server'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

export const getDemo = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('demo').collect()
  },
})

// db-gen:base:start
export const length = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('demo').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  handler: async (ctx, args) => {
    return await ctx.db.query('demo').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('demo')},
  handler: async (ctx, args) => {
    return await ctx.db.get('demo', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      username: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('demo', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('demo'),
    patch: v.object({
      username: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('demo', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('demo')},
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
