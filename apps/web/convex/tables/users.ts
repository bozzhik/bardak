import {mutation, query} from '@convex/_generated/server'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

const chatKindValidator = v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup'))
const nullableStringValidator = v.union(v.string(), v.null())
const nullableBooleanValidator = v.union(v.boolean(), v.null())

const userIdentityArgs = {
  userId: v.number(),
  chatId: v.number(),
  chatKind: chatKindValidator,
  isBotAccount: v.boolean(),
  username: nullableStringValidator,
  firstName: nullableStringValidator,
  lastName: nullableStringValidator,
  languageCode: nullableStringValidator,
  isPremium: nullableBooleanValidator,
  timezone: nullableStringValidator,
  locale: nullableStringValidator,
} as const

export const registerFromTelegramStart = mutation({
  args: {
    ...userIdentityArgs,
    startPayload: nullableStringValidator,
    registrationSource: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal('created'), v.literal('updated')),
    userId: v.id('users'),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()

    if (existingUser === null) {
      const userDocId = await ctx.db.insert('users', {
        userId: args.userId,
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
        languageCode: args.languageCode,
        isPremium: args.isPremium,
        isBotAccount: args.isBotAccount,
        botChatId: args.chatKind === 'bot' ? args.chatId : null,
        lastChatId: args.chatId,
        lastChatKind: args.chatKind,
        firstSeenAt: now,
        lastSeenAt: now,
        lastStartAt: now,
        startPayload: args.startPayload,
        registrationSource: args.registrationSource,
        status: args.isBotAccount ? 'blocked' : 'active',
        isBlocked: false,
        blockedAt: null,
        unblockedAt: null,
        webAuthId: null,
        timezone: args.timezone,
        locale: args.locale,
        updatesCount: 1,
        commandsCount: 1,
        startsCount: 1,
        mirroredCount: 0,
        errorsCount: 0,
      })

      return {
        status: 'created' as const,
        userId: userDocId,
      }
    }

    const shouldUnblock = existingUser.isBlocked
    await ctx.db.patch(existingUser._id, {
      username: args.username,
      firstName: args.firstName,
      lastName: args.lastName,
      languageCode: args.languageCode,
      isPremium: args.isPremium,
      isBotAccount: args.isBotAccount,
      botChatId: args.chatKind === 'bot' ? args.chatId : existingUser.botChatId,
      lastChatId: args.chatId,
      lastChatKind: args.chatKind,
      lastSeenAt: now,
      lastStartAt: now,
      startPayload: args.startPayload,
      registrationSource: args.registrationSource,
      status: existingUser.status === 'blocked' && !args.isBotAccount ? 'active' : existingUser.status,
      isBlocked: false,
      unblockedAt: shouldUnblock ? now : existingUser.unblockedAt,
      timezone: args.timezone,
      locale: args.locale,
      updatesCount: existingUser.updatesCount + 1,
      commandsCount: existingUser.commandsCount + 1,
      startsCount: existingUser.startsCount + 1,
    })

    return {
      status: 'updated' as const,
      userId: existingUser._id,
    }
  },
})

export const touchFromTelegramText = mutation({
  args: userIdentityArgs,
  returns: v.union(v.object({status: v.literal('updated'), userId: v.id('users')}), v.object({status: v.literal('not_registered')})),
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()

    if (existingUser === null) {
      return {status: 'not_registered' as const}
    }

    const now = Date.now()
    await ctx.db.patch(existingUser._id, {
      username: args.username,
      firstName: args.firstName,
      lastName: args.lastName,
      languageCode: args.languageCode,
      isPremium: args.isPremium,
      isBotAccount: args.isBotAccount,
      botChatId: args.chatKind === 'bot' ? args.chatId : existingUser.botChatId,
      lastChatId: args.chatId,
      lastChatKind: args.chatKind,
      lastSeenAt: now,
      timezone: args.timezone,
      locale: args.locale,
      status: existingUser.status === 'new' ? 'active' : existingUser.status,
      updatesCount: existingUser.updatesCount + 1,
      mirroredCount: existingUser.mirroredCount + 1,
    })

    return {status: 'updated' as const, userId: existingUser._id}
  },
})

export const incrementTelegramErrorCounter = mutation({
  args: {userId: v.number()},
  returns: v.union(v.object({status: v.literal('updated'), userId: v.id('users')}), v.object({status: v.literal('not_registered')})),
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .unique()

    if (existingUser === null) {
      return {status: 'not_registered' as const}
    }

    await ctx.db.patch(existingUser._id, {
      errorsCount: existingUser.errorsCount + 1,
      lastSeenAt: Date.now(),
    })

    return {status: 'updated' as const, userId: existingUser._id}
  },
})

// ! DO NOT UPDATE MANNUALLY THIS PART – it's generated by the script `scripts/gen-db-meta.mjs`
// db-gen:base:start
export const length = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('users').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  handler: async (ctx, args) => {
    return await ctx.db.query('users').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('users')},
  handler: async (ctx, args) => {
    return await ctx.db.get('users', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      userId: v.number(),
      username: v.union(v.string(), v.null()),
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      languageCode: v.union(v.string(), v.null()),
      isPremium: v.union(v.boolean(), v.null()),
      isBotAccount: v.boolean(),
      botChatId: v.union(v.number(), v.null()),
      lastChatId: v.number(),
      lastChatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup')),
      firstSeenAt: v.number(),
      lastSeenAt: v.number(),
      lastStartAt: v.union(v.number(), v.null()),
      startPayload: v.union(v.string(), v.null()),
      registrationSource: v.string(),
      status: v.union(v.literal('new'), v.literal('active'), v.literal('blocked')),
      isBlocked: v.boolean(),
      blockedAt: v.union(v.number(), v.null()),
      unblockedAt: v.union(v.number(), v.null()),
      webAuthId: v.union(v.string(), v.null()),
      timezone: v.union(v.string(), v.null()),
      locale: v.union(v.string(), v.null()),
      updatesCount: v.number(),
      commandsCount: v.number(),
      startsCount: v.number(),
      mirroredCount: v.number(),
      errorsCount: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('users', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('users'),
    patch: v.object({
      userId: v.optional(v.number()),
      username: v.optional(v.union(v.string(), v.null())),
      firstName: v.optional(v.union(v.string(), v.null())),
      lastName: v.optional(v.union(v.string(), v.null())),
      languageCode: v.optional(v.union(v.string(), v.null())),
      isPremium: v.optional(v.union(v.boolean(), v.null())),
      isBotAccount: v.optional(v.boolean()),
      botChatId: v.optional(v.union(v.number(), v.null())),
      lastChatId: v.optional(v.number()),
      lastChatKind: v.optional(v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup'))),
      firstSeenAt: v.optional(v.number()),
      lastSeenAt: v.optional(v.number()),
      lastStartAt: v.optional(v.union(v.number(), v.null())),
      startPayload: v.optional(v.union(v.string(), v.null())),
      registrationSource: v.optional(v.string()),
      status: v.optional(v.union(v.literal('new'), v.literal('active'), v.literal('blocked'))),
      isBlocked: v.optional(v.boolean()),
      blockedAt: v.optional(v.union(v.number(), v.null())),
      unblockedAt: v.optional(v.union(v.number(), v.null())),
      webAuthId: v.optional(v.union(v.string(), v.null())),
      timezone: v.optional(v.union(v.string(), v.null())),
      locale: v.optional(v.union(v.string(), v.null())),
      updatesCount: v.optional(v.number()),
      commandsCount: v.optional(v.number()),
      startsCount: v.optional(v.number()),
      mirroredCount: v.optional(v.number()),
      errorsCount: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('users', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('users')},
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
