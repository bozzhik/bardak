import {defineSchema, defineTable} from 'convex/server'
import {v} from 'convex/values'

export default defineSchema({
  waitlist: defineTable({
    username: v.string(),
    telegramLink: v.string(),
    status: v.optional(v.union(v.literal('active'), v.literal('converted'), v.literal('archived'))),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_username', ['username'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

  users: defineTable({
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
  })
    .index('by_telegramId', ['telegramId'])
    .index('by_botChatId', ['botChatId'])
    .index('by_webAuthId', ['webAuthId'])
    .index('by_username', ['username'])
    .index('by_status_and_lastSeenAt', ['status', 'lastSeenAt'])
    .index('by_lastSeenAt', ['lastSeenAt']),

  entries: defineTable({
    userId: v.id('users'),
    source: v.literal('telegram'),
    sourceChatId: v.number(),
    sourceMessageId: v.number(),
    kind: v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported')),
    status: v.union(v.literal('inbox'), v.literal('saved'), v.literal('archived')),
    text: v.union(v.string(), v.null()),
    description: v.union(v.string(), v.null()),
    descriptionSource: v.union(v.literal('none'), v.literal('text'), v.literal('caption'), v.literal('user'), v.literal('ai')),
    url: v.union(v.string(), v.null()),
    telegram: v.object({
      type: v.string(),
      context: v.object({
        forwardOrigin: v.union(v.string(), v.null()),
        forwardDate: v.union(v.number(), v.null()),
        replyToMessageId: v.union(v.number(), v.null()),
      }),
      file: v.object({
        fileId: v.union(v.string(), v.null()),
        fileUniqueId: v.union(v.string(), v.null()),
        fileName: v.union(v.string(), v.null()),
        mimeType: v.union(v.string(), v.null()),
        fileSize: v.union(v.number(), v.null()),
        duration: v.union(v.number(), v.null()),
        width: v.union(v.number(), v.null()),
        height: v.union(v.number(), v.null()),
        emoji: v.union(v.string(), v.null()),
        setName: v.union(v.string(), v.null()),
        isAnimated: v.union(v.boolean(), v.null()),
        isVideo: v.union(v.boolean(), v.null()),
      }),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.union(v.number(), v.null()),
  })
    .index('by_userId_and_sourceChatId_and_sourceMessageId', ['userId', 'sourceChatId', 'sourceMessageId'])
    .index('by_userId_and_status_and_createdAt', ['userId', 'status', 'createdAt'])
    .index('by_userId_and_kind', ['userId', 'kind'])
    .index('by_userId_and_createdAt', ['userId', 'createdAt']),

  tags: defineTable({
    userId: v.id('users'),
    name: v.string(),
    slug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_userId_and_slug', ['userId', 'slug'])
    .index('by_userId_and_createdAt', ['userId', 'createdAt']),

  entryTags: defineTable({
    userId: v.id('users'),
    entryId: v.id('entries'),
    tagId: v.id('tags'),
    createdAt: v.number(),
  })
    .index('by_entryId', ['entryId'])
    .index('by_tagId', ['tagId'])
    .index('by_userId_and_tagId', ['userId', 'tagId'])
    .index('by_userId_and_entryId', ['userId', 'entryId'])
    .index('by_userId_and_entryId_and_tagId', ['userId', 'entryId', 'tagId']),

  pages: defineTable({
    userId: v.id('users'),
    source: v.literal('tag'),
    tagId: v.id('tags'),
    title: v.string(),
    status: v.union(v.literal('published'), v.literal('archived')),
    shareSlug: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.union(v.number(), v.null()),
  })
    .index('by_shareSlug', ['shareSlug'])
    .index('by_userId_and_tagId', ['userId', 'tagId'])
    .index('by_userId_and_status_and_createdAt', ['userId', 'status', 'createdAt']),

  pageItems: defineTable({
    userId: v.id('users'),
    pageId: v.id('pages'),
    entryId: v.id('entries'),
    status: v.union(v.literal('visible'), v.literal('hidden')),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_pageId_and_position', ['pageId', 'position'])
    .index('by_pageId_and_status_and_position', ['pageId', 'status', 'position'])
    .index('by_userId_and_pageId_and_entryId', ['userId', 'pageId', 'entryId']),

  flows: defineTable({
    userId: v.id('users'),
    chatId: v.number(),
    kind: v.union(v.literal('tag'), v.literal('description')),
    status: v.union(v.literal('active'), v.literal('done'), v.literal('cancelled')),
    entryId: v.union(v.id('entries'), v.null()),
    step: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.union(v.number(), v.null()),
  })
    .index('by_userId_and_chatId_and_status', ['userId', 'chatId', 'status'])
    .index('by_userId_and_status', ['userId', 'status'])
    .index('by_userId_and_updatedAt', ['userId', 'updatedAt']),

  botEvents: defineTable({
    userId: v.union(v.id('users'), v.null()),
    telegramId: v.union(v.number(), v.null()),
    chatId: v.union(v.number(), v.null()),
    chatKind: v.union(v.literal('bot'), v.literal('group'), v.literal('supergroup'), v.null()),
    source: v.literal('telegram'),
    kind: v.union(v.literal('command'), v.literal('message'), v.literal('flow'), v.literal('entry'), v.literal('error'), v.literal('system')),
    action: v.string(),
    status: v.union(v.literal('ok'), v.literal('ignored'), v.literal('rejected'), v.literal('error')),
    command: v.union(v.string(), v.null()),
    messageKind: v.union(v.literal('text'), v.literal('link'), v.literal('photo'), v.literal('voice'), v.literal('audio'), v.literal('document'), v.literal('video'), v.literal('sticker'), v.literal('unsupported'), v.null()),
    entryId: v.union(v.id('entries'), v.null()),
    flowId: v.union(v.id('flows'), v.null()),
    context: v.object({
      updateId: v.union(v.number(), v.null()),
      messageId: v.union(v.number(), v.null()),
      textLength: v.union(v.number(), v.null()),
      errorName: v.union(v.string(), v.null()),
      reason: v.union(v.string(), v.null()),
    }),
    createdAt: v.number(),
  })
    .index('by_userId_and_createdAt', ['userId', 'createdAt'])
    .index('by_telegramId_and_createdAt', ['telegramId', 'createdAt'])
    .index('by_chatId_and_createdAt', ['chatId', 'createdAt'])
    .index('by_kind_and_createdAt', ['kind', 'createdAt'])
    .index('by_action_and_createdAt', ['action', 'createdAt'])
    .index('by_status_and_createdAt', ['status', 'createdAt']),

  // Planned next (not in this MVP iteration):
  // user_metrics_daily
})
