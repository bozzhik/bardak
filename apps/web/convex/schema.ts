import {defineSchema, defineTable} from 'convex/server'
import {v} from 'convex/values'

export default defineSchema({
  demo: defineTable({
    username: v.string(),
  }).index('by_username', ['username']),
  users: defineTable({
    telegramUserId: v.number(),
    username: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  }).index('by_telegram_user_id', ['telegramUserId']),
  content: defineTable({
    userId: v.id('users'),
    telegramChatId: v.number(),
    telegramMessageId: v.number(),
    contentType: v.string(),
    text: v.optional(v.string()),
    payloadJson: v.string(),
  })
    .index('by_user_id', ['userId'])
    .index('by_telegram_chat_id_and_telegram_message_id', ['telegramChatId', 'telegramMessageId']),
})
