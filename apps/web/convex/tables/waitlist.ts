import {mutation} from '@convex/_generated/server'
import {v} from 'convex/values'

const TELEGRAM_USERNAME_RE = /^[a-z0-9_]{3,30}$/

function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase()
}

export const submit = mutation({
  args: {
    username: v.string(),
  },
  returns: v.union(v.object({status: v.literal('created'), id: v.id('waitlist')}), v.object({status: v.literal('duplicate')}), v.object({status: v.literal('invalid'), message: v.string()})),
  handler: async (ctx, args) => {
    const username = normalizeUsername(args.username)
    if (!TELEGRAM_USERNAME_RE.test(username)) {
      return {
        status: 'invalid' as const,
        message: 'Никнейм: 3–30 символа, латиница, цифры и подчёркивание.',
      }
    }

    const existing = await ctx.db
      .query('waitlist')
      .withIndex('by_username', (q) => q.eq('username', username))
      .unique()

    if (existing !== null) {
      return {status: 'duplicate' as const}
    }

    const telegramLink = `https://t.me/${username}`
    const id = await ctx.db.insert('waitlist', {
      username,
      telegramLink,
    })

    return {status: 'created' as const, id}
  },
})
