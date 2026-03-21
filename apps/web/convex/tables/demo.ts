import {query} from '@convex/_generated/server'

export const getDemo = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('demo').collect()
  },
})
