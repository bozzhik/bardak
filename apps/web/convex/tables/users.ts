import {mutation, query} from '@convex/_generated/server'
import {paginationOptsValidator} from 'convex/server'
import {v} from 'convex/values'

const chatKindValidator = v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup'))
const nullableStringValidator = v.union(v.string(), v.null())
const nullableBooleanValidator = v.union(v.boolean(), v.null())

const userIdentityArgs = {
  telegramId: v.number(),
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

type UserIdentityInput = {
  firstName: string | null
  lastName: string | null
  languageCode: string | null
  isPremium: boolean | null
  isBotAccount: boolean
  timezone: string | null
  locale: string | null
}

function buildProfile(args: UserIdentityInput) {
  return {
    firstName: args.firstName,
    lastName: args.lastName,
    languageCode: args.languageCode,
    isPremium: args.isPremium,
    isBot: args.isBotAccount,
  }
}

function buildSettings(args: UserIdentityInput) {
  return {
    timezone: args.timezone,
    locale: args.locale,
  }
}

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
      .withIndex('by_telegramId', (q) => q.eq('telegramId', args.telegramId))
      .unique()

    if (existingUser === null) {
      const userDocId = await ctx.db.insert('users', {
        telegramId: args.telegramId,
        username: args.username,
        botChatId: args.chatKind === 'bot' ? args.chatId : null,
        webAuthId: null,
        status: args.isBotAccount ? 'blocked' : 'active',
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        profile: buildProfile(args),
        settings: buildSettings(args),
        telegram: {
          lastChatId: args.chatId,
          lastChatKind: args.chatKind,
          lastStartAt: now,
          startPayload: args.startPayload,
          registrationSource: args.registrationSource,
        },
        stats: {
          updates: 1,
          commands: 1,
          starts: 1,
          captures: 0,
          errors: 0,
        },
        moderation: {
          blockedAt: args.isBotAccount ? now : null,
          unblockedAt: null,
        },
      })

      return {
        status: 'created' as const,
        userId: userDocId,
      }
    }

    const shouldUnblock = existingUser.status === 'blocked' && !args.isBotAccount
    await ctx.db.patch(existingUser._id, {
      username: args.username,
      botChatId: args.chatKind === 'bot' ? args.chatId : existingUser.botChatId,
      updatedAt: now,
      lastSeenAt: now,
      status: shouldUnblock ? 'active' : existingUser.status,
      profile: buildProfile(args),
      settings: buildSettings(args),
      telegram: {
        ...existingUser.telegram,
        lastChatId: args.chatId,
        lastChatKind: args.chatKind,
        lastStartAt: now,
        startPayload: args.startPayload,
        registrationSource: args.registrationSource,
      },
      stats: {
        ...existingUser.stats,
        updates: existingUser.stats.updates + 1,
        commands: existingUser.stats.commands + 1,
        starts: existingUser.stats.starts + 1,
      },
      moderation: {
        ...existingUser.moderation,
        unblockedAt: shouldUnblock ? now : existingUser.moderation.unblockedAt,
      },
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
      .withIndex('by_telegramId', (q) => q.eq('telegramId', args.telegramId))
      .unique()

    if (existingUser === null) {
      return {status: 'not_registered' as const}
    }

    const now = Date.now()
    await ctx.db.patch(existingUser._id, {
      username: args.username,
      botChatId: args.chatKind === 'bot' ? args.chatId : existingUser.botChatId,
      updatedAt: now,
      lastSeenAt: now,
      status: existingUser.status === 'new' ? 'active' : existingUser.status,
      profile: buildProfile(args),
      settings: buildSettings(args),
      telegram: {
        ...existingUser.telegram,
        lastChatId: args.chatId,
        lastChatKind: args.chatKind,
      },
      stats: {
        ...existingUser.stats,
        updates: existingUser.stats.updates + 1,
        captures: existingUser.stats.captures + 1,
      },
    })

    return {status: 'updated' as const, userId: existingUser._id}
  },
})

export const incrementTelegramErrorCounter = mutation({
  args: {telegramId: v.number()},
  returns: v.union(v.object({status: v.literal('updated'), userId: v.id('users')}), v.object({status: v.literal('not_registered')})),
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_telegramId', (q) => q.eq('telegramId', args.telegramId))
      .unique()

    if (existingUser === null) {
      return {status: 'not_registered' as const}
    }

    const now = Date.now()
    await ctx.db.patch(existingUser._id, {
      updatedAt: now,
      lastSeenAt: now,
      stats: {
        ...existingUser.stats,
        errors: existingUser.stats.errors + 1,
      },
    })

    return {status: 'updated' as const, userId: existingUser._id}
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
    const rows = await ctx.db.query('users').take(5000)
    return {count: rows.length, isTruncated: rows.length === 5000}
  },
})

export const list = query({
  args: {paginationOpts: paginationOptsValidator},
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id('users'),
        _creationTime: v.number(),
        telegramId: v.number(),
        username: v.union(v.string(), v.null()),
        botChatId: v.union(v.number(), v.null()),
        webAuthId: v.union(v.string(), v.null()),
        status: v.union(v.literal('new'), v.literal('active'), v.literal('blocked')),
        createdAt: v.number(),
        updatedAt: v.number(),
        lastSeenAt: v.number(),
        profile: v.object({
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          languageCode: v.union(v.string(), v.null()),
          isPremium: v.union(v.boolean(), v.null()),
          isBot: v.boolean(),
        }),
        settings: v.object({
          timezone: v.union(v.string(), v.null()),
          locale: v.union(v.string(), v.null()),
        }),
        telegram: v.object({
          lastChatId: v.number(),
          lastChatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup')),
          lastStartAt: v.union(v.number(), v.null()),
          startPayload: v.union(v.string(), v.null()),
          registrationSource: v.string(),
        }),
        stats: v.object({
          updates: v.number(),
          commands: v.number(),
          starts: v.number(),
          captures: v.number(),
          errors: v.number(),
        }),
        moderation: v.object({
          blockedAt: v.union(v.number(), v.null()),
          unblockedAt: v.union(v.number(), v.null()),
        }),
      }),
    ),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    return await ctx.db.query('users').order('desc').paginate(args.paginationOpts)
  },
})

export const getById = query({
  args: {id: v.id('users')},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      telegramId: v.number(),
      username: v.union(v.string(), v.null()),
      botChatId: v.union(v.number(), v.null()),
      webAuthId: v.union(v.string(), v.null()),
      status: v.union(v.literal('new'), v.literal('active'), v.literal('blocked')),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastSeenAt: v.number(),
      profile: v.object({
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        languageCode: v.union(v.string(), v.null()),
        isPremium: v.union(v.boolean(), v.null()),
        isBot: v.boolean(),
      }),
      settings: v.object({
        timezone: v.union(v.string(), v.null()),
        locale: v.union(v.string(), v.null()),
      }),
      telegram: v.object({
        lastChatId: v.number(),
        lastChatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup')),
        lastStartAt: v.union(v.number(), v.null()),
        startPayload: v.union(v.string(), v.null()),
        registrationSource: v.string(),
      }),
      stats: v.object({
        updates: v.number(),
        commands: v.number(),
        starts: v.number(),
        captures: v.number(),
        errors: v.number(),
      }),
      moderation: v.object({
        blockedAt: v.union(v.number(), v.null()),
        unblockedAt: v.union(v.number(), v.null()),
      }),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get('users', args.id)
  },
})

export const create = mutation({
  args: {
    doc: v.object({
      telegramId: v.number(),
      username: v.union(v.string(), v.null()),
      botChatId: v.union(v.number(), v.null()),
      webAuthId: v.union(v.string(), v.null()),
      status: v.union(v.literal('new'), v.literal('active'), v.literal('blocked')),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastSeenAt: v.number(),
      profile: v.object({
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        languageCode: v.union(v.string(), v.null()),
        isPremium: v.union(v.boolean(), v.null()),
        isBot: v.boolean(),
      }),
      settings: v.object({
        timezone: v.union(v.string(), v.null()),
        locale: v.union(v.string(), v.null()),
      }),
      telegram: v.object({
        lastChatId: v.number(),
        lastChatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup')),
        lastStartAt: v.union(v.number(), v.null()),
        startPayload: v.union(v.string(), v.null()),
        registrationSource: v.string(),
      }),
      stats: v.object({
        updates: v.number(),
        commands: v.number(),
        starts: v.number(),
        captures: v.number(),
        errors: v.number(),
      }),
      moderation: v.object({
        blockedAt: v.union(v.number(), v.null()),
        unblockedAt: v.union(v.number(), v.null()),
      }),
    }),
  },
  returns: v.id('users'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('users', args.doc)
  },
})

export const update = mutation({
  args: {
    id: v.id('users'),
    patch: v.object({
      telegramId: v.optional(v.number()),
      username: v.optional(v.union(v.string(), v.null())),
      botChatId: v.optional(v.union(v.number(), v.null())),
      webAuthId: v.optional(v.union(v.string(), v.null())),
      status: v.optional(v.union(v.literal('new'), v.literal('active'), v.literal('blocked'))),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
      lastSeenAt: v.optional(v.number()),
      profile: v.optional(
        v.object({
          firstName: v.union(v.string(), v.null()),
          lastName: v.union(v.string(), v.null()),
          languageCode: v.union(v.string(), v.null()),
          isPremium: v.union(v.boolean(), v.null()),
          isBot: v.boolean(),
        }),
      ),
      settings: v.optional(
        v.object({
          timezone: v.union(v.string(), v.null()),
          locale: v.union(v.string(), v.null()),
        }),
      ),
      telegram: v.optional(
        v.object({
          lastChatId: v.number(),
          lastChatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup')),
          lastStartAt: v.union(v.number(), v.null()),
          startPayload: v.union(v.string(), v.null()),
          registrationSource: v.string(),
        }),
      ),
      stats: v.optional(
        v.object({
          updates: v.number(),
          commands: v.number(),
          starts: v.number(),
          captures: v.number(),
          errors: v.number(),
        }),
      ),
      moderation: v.optional(
        v.object({
          blockedAt: v.union(v.number(), v.null()),
          unblockedAt: v.union(v.number(), v.null()),
        }),
      ),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch('users', args.id, args.patch)
    return null
  },
})

export const remove = mutation({
  args: {id: v.id('users')},
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
    return null
  },
})
// db-gen:base:end
