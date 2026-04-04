import {mutation} from './_generated/server'
import {v} from 'convex/values'

export const upsertTelegramUser = mutation({
  args: {
    telegramUserId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_telegram_user_id', (query) => query.eq('telegramUserId', args.telegramUserId))
      .unique()

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
      })
      return existingUser._id
    }

    const userId = await ctx.db.insert('users', {
      telegramUserId: args.telegramUserId,
      username: args.username,
      firstName: args.firstName,
      lastName: args.lastName,
    })

    await ctx.db.insert('content', {
      userId,
      telegramChatId: 0,
      telegramMessageId: 0,
      contentType: 'demo',
      text: 'Welcome to Bardak',
      payloadJson: JSON.stringify({source: 'system', event: 'registration'}),
    })

    return userId
  },
})

export const saveIncomingContent = mutation({
  args: {
    telegramUserId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    telegramChatId: v.number(),
    telegramMessageId: v.number(),
    contentType: v.string(),
    text: v.optional(v.string()),
    payloadJson: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_telegram_user_id', (query) => query.eq('telegramUserId', args.telegramUserId))
      .unique()

    const userId =
      existingUser?._id ??
      (await ctx.db.insert('users', {
        telegramUserId: args.telegramUserId,
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
      }))

    return await ctx.db.insert('content', {
      userId,
      telegramChatId: args.telegramChatId,
      telegramMessageId: args.telegramMessageId,
      contentType: args.contentType,
      text: args.text,
      payloadJson: args.payloadJson,
    })
  },
})
