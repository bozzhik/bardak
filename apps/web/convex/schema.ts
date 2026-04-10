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
})
