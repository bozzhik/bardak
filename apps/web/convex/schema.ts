import {defineSchema, defineTable} from 'convex/server'
import {v} from 'convex/values'

export default defineSchema({
  demo: defineTable({
    username: v.string(),
  }).index('by_username', ['username']),

  waitlist: defineTable({
    username: v.string(),
    telegramLink: v.string(),
  }).index('by_username', ['username']),

  users: defineTable({
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
  })
    .index('by_userId', ['userId'])
    .index('by_botChatId', ['botChatId'])
    .index('by_lastChatId', ['lastChatId'])
    .index('by_username', ['username'])
    .index('by_lastSeenAt', ['lastSeenAt']),

  // Planned next (not in this MVP iteration):
  // user_metrics_daily
  // bot_events (or bot_telemetry)
})
