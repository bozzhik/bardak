import {describe, expect, test} from 'bun:test'
import {convexTest} from 'convex-test'
import {makeFunctionReference} from 'convex/server'

import type {Id} from '../_generated/dataModel'
import schema from '../schema'

type SaveEntryArgs = {
  userId: Id<'users'>
  sourceChatId: number
  sourceMessageId: number
  kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
  text: string | null
  description: string | null
  descriptionSource?: 'none' | 'text' | 'caption' | 'user' | 'ai'
  url: string | null
  tags: string[]
  telegram?: {
    type: string
    context: {
      forwardOrigin: string | null
      forwardDate: number | null
      replyToMessageId: number | null
    }
    file: {
      fileId: string | null
      fileUniqueId: string | null
      fileName: string | null
      mimeType: string | null
      fileSize: number | null
      duration: number | null
      width: number | null
      height: number | null
      emoji: string | null
      setName: string | null
      isAnimated: boolean | null
      isVideo: boolean | null
    }
  }
}

type SaveEntryResult = {
  status: 'created' | 'duplicate'
  entryId: Id<'entries'>
  entryStatus: 'inbox' | 'saved' | 'archived'
  tagIds: Array<Id<'tags'>>
}

type UpsertFlowArgs = {
  userId: Id<'users'>
  chatId: number
  kind: 'tag'
  entryId: Id<'entries'>
}

type UpsertFlowResult = {
  status: 'created' | 'replaced'
  flowId: Id<'flows'>
}

type CompleteTagFlowArgs = {
  userId: Id<'users'>
  chatId: number
  tags: string[]
}

type CompleteTagFlowResult =
  | {
      status: 'no_active'
    }
  | {
      status: 'invalid_tag'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
    }
  | {
      status: 'tagged'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
      tagIds: Array<Id<'tags'>>
    }

type CompleteTagFlowByIdArgs = {
  userId: Id<'users'>
  chatId: number
  tagId: Id<'tags'>
}

type CompleteTagFlowByIdResult =
  | {
      status: 'no_active' | 'missing_tag'
    }
  | {
      status: 'tagged'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
      tagId: Id<'tags'>
      tagName: string
    }

type RegisterUserArgs = {
  telegramId: number
  chatId: number
  chatKind: 'bot' | 'group' | 'supergroup'
  isBotAccount: boolean
  username: string | null
  firstName: string | null
  lastName: string | null
  languageCode: string | null
  isPremium: boolean | null
  timezone: string | null
  locale: string | null
  startPayload: string | null
  registrationSource: string
}

type RegisterUserResult = {
  status: 'created' | 'updated'
  userId: Id<'users'>
}

const saveEntryRef = makeFunctionReference<'mutation', SaveEntryArgs, SaveEntryResult>('tables/entries:save')
const upsertFlowRef = makeFunctionReference<'mutation', UpsertFlowArgs, UpsertFlowResult>('tables/flows:upsertActive')
const completeTagFlowRef = makeFunctionReference<'mutation', CompleteTagFlowArgs, CompleteTagFlowResult>('tables/flows:completeTag')
const completeTagFlowByIdRef = makeFunctionReference<'mutation', CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult>('tables/flows:completeTagById')
const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/entries.ts': () => import('./entries'),
  '../tables/flows.ts': () => import('./flows'),
  '../tables/users.ts': () => import('./users'),
}

async function createUser(t: ReturnType<typeof convexTest>): Promise<Id<'users'>> {
  const result = await t.mutation(registerUserRef, {
    telegramId: 1001,
    chatId: 2001,
    chatKind: 'bot',
    isBotAccount: false,
    username: 'bozzhik',
    firstName: 'Bo',
    lastName: null,
    languageCode: 'ru',
    isPremium: null,
    timezone: null,
    locale: 'ru',
    startPayload: null,
    registrationSource: 'telegram_start',
  })

  return result.userId
}

function createText(userId: Id<'users'>, overrides: Partial<SaveEntryArgs> = {}): SaveEntryArgs {
  return {
    userId,
    sourceChatId: 2001,
    sourceMessageId: 3001,
    kind: 'text',
    text: 'Read this #Ideas #покупки',
    description: null,
    url: null,
    tags: [],
    ...overrides,
  }
}

function createTelegram(overrides: Partial<NonNullable<SaveEntryArgs['telegram']>> = {}): NonNullable<SaveEntryArgs['telegram']> {
  return {
    type: 'message:text',
    context: {
      forwardOrigin: null,
      forwardDate: null,
      replyToMessageId: null,
    },
    file: {
      fileId: null,
      fileUniqueId: null,
      fileName: null,
      mimeType: null,
      fileSize: null,
      duration: null,
      width: null,
      height: null,
      emoji: null,
      setName: null,
      isAnimated: null,
      isVideo: null,
    },
    ...overrides,
  }
}

describe('entries data model', () => {
  test('keeps Telegram source saves idempotent per user', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)

    const first = await t.mutation(saveEntryRef, createText(userId, {text: 'same'}))
    const second = await t.mutation(saveEntryRef, createText(userId, {text: 'same again'}))
    const rows = await t.run((ctx) => ctx.db.query('entries').take(10))

    expect(first.status).toBe('created')
    expect(second).toMatchObject({status: 'duplicate', entryId: first.entryId})
    expect(rows).toHaveLength(1)
  })

  test('stores entries without tags as inbox and tagged entries as saved', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)

    const inbox = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1, tags: []}))
    const saved = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 2, tags: ['#ideas']}))

    expect(inbox.entryStatus).toBe('inbox')
    expect(saved.entryStatus).toBe('saved')
  })

  test('normalizes tags, deduplicates slugs per user, and supports multiple entry links', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)

    const first = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1, tags: ['#Ideas', '#покупки']}))
    const second = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 2, tags: ['#ideas']}))
    const tags = await t.run((ctx) => ctx.db.query('tags').take(10))
    const links = await t.run((ctx) => ctx.db.query('entryTags').take(10))

    expect(first.tagIds).toHaveLength(2)
    expect(second.tagIds).toHaveLength(1)
    expect(tags.map((tag) => ({name: tag.name, slug: tag.slug})).sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
      {name: 'ideas', slug: 'ideas'},
      {name: 'покупки', slug: 'покупки'},
    ])
    expect(links).toHaveLength(3)
  })

  test('keeps only one active flow per user and chat', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const firstEntry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1}))
    const secondEntry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 2}))

    const first = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: firstEntry.entryId})
    const second = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: secondEntry.entryId})
    const activeFlows = await t.run((ctx) =>
      ctx.db
        .query('flows')
        .withIndex('by_userId_and_chatId_and_status', (q) => q.eq('userId', userId).eq('chatId', 2001).eq('status', 'active'))
        .take(10),
    )

    expect(first.status).toBe('created')
    expect(second.status).toBe('replaced')
    expect(activeFlows).toHaveLength(1)
    expect(activeFlows[0]?.entryId).toBe(secondEntry.entryId)
  })

  test('completes active tag flow by linking a tag and saving the entry', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: entry.entryId})

    const result = await t.mutation(completeTagFlowRef, {userId, chatId: 2001, tags: ['#покупки']})
    const savedEntry = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))
    const links = await t.run((ctx) =>
      ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_entryId', (q) => q.eq('userId', userId).eq('entryId', entry.entryId))
        .take(10),
    )

    expect(result).toMatchObject({
      status: 'tagged',
      flowId: flow.flowId,
      entryId: entry.entryId,
    })
    expect(result.status === 'tagged' ? result.tagIds : []).toHaveLength(1)
    expect(savedEntry?.status).toBe('saved')
    expect(savedFlow?.status).toBe('done')
    expect(links).toHaveLength(1)

    const second = await t.mutation(completeTagFlowRef, {userId, chatId: 2001, tags: ['#ещё']})
    expect(second).toEqual({status: 'no_active'})
  })

  test('keeps active tag flow open when the next text has no hashtag', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: entry.entryId})

    const result = await t.mutation(completeTagFlowRef, {userId, chatId: 2001, tags: []})
    const savedEntry = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))

    expect(result).toEqual({
      status: 'invalid_tag',
      flowId: flow.flowId,
      entryId: entry.entryId,
    })
    expect(savedEntry?.status).toBe('inbox')
    expect(savedFlow?.status).toBe('active')
  })

  test('completes active tag flow from a tag callback', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: entry.entryId})
    const tagId = await t.run((ctx) =>
      ctx.db.insert('tags', {
        userId,
        name: 'work',
        slug: 'work',
        createdAt: 1,
        updatedAt: 1,
      }),
    )

    const result = await t.mutation(completeTagFlowByIdRef, {userId, chatId: 2001, tagId})
    const savedEntry = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))
    const links = await t.run((ctx) =>
      ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_entryId_and_tagId', (q) => q.eq('userId', userId).eq('entryId', entry.entryId).eq('tagId', tagId))
        .take(10),
    )

    expect(result).toEqual({
      status: 'tagged',
      flowId: flow.flowId,
      entryId: entry.entryId,
      tagId,
      tagName: 'work',
    })
    expect(savedEntry?.status).toBe('saved')
    expect(savedFlow?.status).toBe('done')
    expect(links).toHaveLength(1)
  })

  test('stores unsupported Telegram messages with typed metadata for later description', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)

    const saved = await t.mutation(
      saveEntryRef,
      createText(userId, {
        sourceMessageId: 77,
        kind: 'unsupported',
        text: null,
        description: null,
        descriptionSource: 'none',
        telegram: createTelegram({
          type: 'message:location',
          context: {
            forwardOrigin: 'hidden_user',
            forwardDate: 1790000000000,
            replyToMessageId: 76,
          },
        }),
      }),
    )
    const row = await t.run((ctx) => ctx.db.get(saved.entryId))

    expect(saved.entryStatus).toBe('inbox')
    expect(row?.kind).toBe('unsupported')
    expect(row?.descriptionSource).toBe('none')
    expect(row?.telegram.type).toBe('message:location')
    expect(row?.telegram.context.replyToMessageId).toBe(76)
  })
})
