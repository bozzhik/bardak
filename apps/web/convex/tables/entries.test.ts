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

type UpdateEntryFromEditResult =
  | {
      status: 'no_existing'
    }
  | {
      status: 'updated'
      entryId: Id<'entries'>
      entryStatus: 'inbox' | 'saved' | 'archived'
      tagIds: Array<Id<'tags'>>
    }

type ArchiveEntryBySourceMessageArgs = {
  userId: Id<'users'>
  sourceChatId: number
  sourceMessageId: number
}

type ArchiveEntryBySourceMessageResult =
  | {
      status: 'missing'
    }
  | {
      status: 'archived'
      entryId: Id<'entries'>
    }

type UpsertFlowArgs = {
  userId: Id<'users'>
  chatId: number
  kind: 'tag' | 'description'
  entryId: Id<'entries'>
}

type UpsertFlowResult = {
  status: 'created' | 'replaced'
  flowId: Id<'flows'>
}

type GetActiveFlowArgs = {
  userId: Id<'users'>
  chatId: number
}

type GetActiveFlowResult =
  | {
      status: 'none'
    }
  | {
      status: 'active'
      flowId: Id<'flows'>
      kind: 'tag' | 'description'
      entryId: Id<'entries'> | null
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

type CancelTagFlowArgs = {
  userId: Id<'users'>
  chatId: number
  entryId: Id<'entries'>
}

type CancelTagFlowResult =
  | {
      status: 'no_active'
    }
  | {
      status: 'cancelled'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
    }

type CompleteDescriptionFlowArgs = {
  userId: Id<'users'>
  chatId: number
  description: string
}

type CompleteDescriptionFlowResult =
  | {
      status: 'no_active'
    }
  | {
      status: 'invalid_description'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
    }
  | {
      status: 'described'
      flowId: Id<'flows'>
      entryId: Id<'entries'>
      description: string
    }

type CountInboxArgs = {
  userId: Id<'users'>
  limit?: number
}

type CountInboxResult = {
  count: number
  isTruncated: boolean
}

type GetNextInboxArgs = {
  userId: Id<'users'>
}

type GetNextInboxResult =
  | {
      status: 'empty'
    }
  | {
      status: 'found'
      entry: {
        id: Id<'entries'>
        kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
        text: string | null
        description: string | null
        url: string | null
        createdAt: number
      }
    }

type SearchEntriesArgs = {
  userId: Id<'users'>
  text?: string | null
  tags?: string[]
  kind?: SaveEntryArgs['kind'] | null
  limit?: number
}

type SearchEntriesResult = {
  items: Array<{
    id: Id<'entries'>
    kind: SaveEntryArgs['kind']
    status: 'inbox' | 'saved'
    text: string | null
    description: string | null
    url: string | null
    createdAt: number
    tags: string[]
  }>
  isTruncated: boolean
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
const updateEntryFromEditRef = makeFunctionReference<'mutation', SaveEntryArgs, UpdateEntryFromEditResult>('tables/entries:updateFromTelegramEdit')
const archiveEntryBySourceMessageRef = makeFunctionReference<'mutation', ArchiveEntryBySourceMessageArgs, ArchiveEntryBySourceMessageResult>('tables/entries:archiveBySourceMessage')
const upsertFlowRef = makeFunctionReference<'mutation', UpsertFlowArgs, UpsertFlowResult>('tables/flows:upsertActive')
const getActiveFlowRef = makeFunctionReference<'query', GetActiveFlowArgs, GetActiveFlowResult>('tables/flows:getActive')
const completeTagFlowRef = makeFunctionReference<'mutation', CompleteTagFlowArgs, CompleteTagFlowResult>('tables/flows:completeTag')
const completeTagFlowByIdRef = makeFunctionReference<'mutation', CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult>('tables/flows:completeTagById')
const completeDescriptionFlowRef = makeFunctionReference<'mutation', CompleteDescriptionFlowArgs, CompleteDescriptionFlowResult>('tables/flows:completeDescription')
const cancelTagFlowRef = makeFunctionReference<'mutation', CancelTagFlowArgs, CancelTagFlowResult>('tables/flows:cancelForEntry')
const countInboxRef = makeFunctionReference<'query', CountInboxArgs, CountInboxResult>('tables/entries:countInbox')
const getNextInboxRef = makeFunctionReference<'query', GetNextInboxArgs, GetNextInboxResult>('tables/entries:getNextInbox')
const searchEntriesRef = makeFunctionReference<'query', SearchEntriesArgs, SearchEntriesResult>('tables/entries:search')
const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/entries.ts': () => import('./entries'),
  '../tables/flows.ts': () => import('./flows'),
  '../tables/users.ts': () => import('./users'),
}

async function createUser(t: ReturnType<typeof convexTest>, telegramId = 1001): Promise<Id<'users'>> {
  const result = await t.mutation(registerUserRef, {
    telegramId,
    chatId: telegramId + 1000,
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

  test('returns the active flow for a user chat without scanning other chats', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 31}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'description', entryId: entry.entryId})

    const active = await t.query(getActiveFlowRef, {userId, chatId: 2001})
    const missing = await t.query(getActiveFlowRef, {userId, chatId: 2002})

    expect(active).toEqual({
      status: 'active',
      flowId: flow.flowId,
      kind: 'description',
      entryId: entry.entryId,
    })
    expect(missing).toEqual({status: 'none'})
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

  test('updates an existing Telegram entry when the source message is edited', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const saved = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 91, text: 'old text #old', tags: ['#old']}))

    const updated = await t.mutation(updateEntryFromEditRef, createText(userId, {sourceMessageId: 91, kind: 'link', text: 'new text https://example.com #new', url: 'https://example.com', tags: ['#new']}))
    const row = await t.run((ctx) => ctx.db.get(saved.entryId))
    const links = await t.run((ctx) =>
      ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_entryId', (q) => q.eq('userId', userId).eq('entryId', saved.entryId))
        .take(10),
    )
    const tags = await t.run((ctx) => Promise.all(links.map((link) => ctx.db.get(link.tagId))))

    expect(updated).toMatchObject({
      status: 'updated',
      entryId: saved.entryId,
      entryStatus: 'saved',
    })
    expect(row?.kind).toBe('link')
    expect(row?.text).toBe('new text https://example.com #new')
    expect(row?.url).toBe('https://example.com')
    expect(tags.map((tag) => tag?.slug)).toEqual(['new'])
  })

  test('archives an entry by replied Telegram source message and cancels its active flow', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceChatId: 2001, sourceMessageId: 92}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: entry.entryId})

    const archived = await t.mutation(archiveEntryBySourceMessageRef, {userId, sourceChatId: 2001, sourceMessageId: 92})
    const row = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))

    expect(archived).toEqual({status: 'archived', entryId: entry.entryId})
    expect(row?.status).toBe('archived')
    expect(typeof row?.archivedAt).toBe('number')
    expect(savedFlow?.status).toBe('cancelled')
  })

  test('searches active entries by text, tag, and kind without returning archived or foreign rows', async () => {
    const t = convexTest(schema, modules)
    const firstUserId = await createUser(t, 1001)
    const secondUserId = await createUser(t, 1002)

    const contract = await t.mutation(saveEntryRef, createText(firstUserId, {sourceMessageId: 101, text: 'Подписать договор с клиентом #работа', tags: ['#работа']}))
    await t.mutation(saveEntryRef, createText(firstUserId, {sourceMessageId: 102, kind: 'photo', text: null, description: 'Фото договора на столе', descriptionSource: 'user', tags: ['#работа']}))
    const archivedEntry = await t.mutation(saveEntryRef, createText(firstUserId, {sourceMessageId: 103, text: 'Старый договор', tags: ['#работа']}))
    await t.mutation(saveEntryRef, createText(secondUserId, {sourceMessageId: 104, text: 'чужой договор #работа', tags: ['#работа']}))
    await t.mutation(archiveEntryBySourceMessageRef, {userId: firstUserId, sourceChatId: 2001, sourceMessageId: 103})

    const byText = await t.query(searchEntriesRef, {userId: firstUserId, text: 'договор', limit: 10})
    const byTagAndKind = await t.query(searchEntriesRef, {userId: firstUserId, tags: ['#работа'], kind: 'photo', limit: 10})

    expect(byText.items.map((item) => item.id)).toContain(contract.entryId)
    expect(byText.items.map((item) => item.id)).not.toContain(archivedEntry.entryId)
    expect(byText.items.every((item) => item.text !== 'чужой договор #работа')).toBe(true)
    expect(byTagAndKind.items).toEqual([
      expect.objectContaining({
        kind: 'photo',
        description: 'Фото договора на столе',
        tags: ['работа'],
      }),
    ])
  })

  test('counts only inbox entries owned by the requested user', async () => {
    const t = convexTest(schema, modules)
    const firstUserId = await createUser(t, 1001)
    const secondUserId = await createUser(t, 1002)

    await t.mutation(saveEntryRef, createText(firstUserId, {sourceMessageId: 1, tags: []}))
    await t.mutation(saveEntryRef, createText(firstUserId, {sourceMessageId: 2, tags: ['#saved']}))
    await t.mutation(saveEntryRef, createText(secondUserId, {sourceMessageId: 3, tags: []}))

    const count = await t.query(countInboxRef, {userId: firstUserId, limit: 100})

    expect(count).toEqual({count: 1, isTruncated: false})
  })

  test('returns the oldest inbox entry for a user', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const oldEntryId = await t.run((ctx) =>
      ctx.db.insert('entries', {
        userId,
        source: 'telegram',
        sourceChatId: 2001,
        sourceMessageId: 1,
        kind: 'text',
        status: 'inbox',
        text: 'old inbox',
        description: null,
        descriptionSource: 'text',
        url: null,
        telegram: createTelegram(),
        createdAt: 1,
        updatedAt: 1,
        archivedAt: null,
      }),
    )
    await t.run((ctx) =>
      ctx.db.insert('entries', {
        userId,
        source: 'telegram',
        sourceChatId: 2001,
        sourceMessageId: 2,
        kind: 'text',
        status: 'inbox',
        text: 'new inbox',
        description: null,
        descriptionSource: 'text',
        url: null,
        telegram: createTelegram(),
        createdAt: 2,
        updatedAt: 2,
        archivedAt: null,
      }),
    )

    const next = await t.query(getNextInboxRef, {userId})

    expect(next).toEqual({
      status: 'found',
      entry: {
        id: oldEntryId,
        kind: 'text',
        text: 'old inbox',
        description: null,
        url: null,
        createdAt: 1,
      },
    })
  })

  test('skipping inbox cancels the active flow but keeps the entry in inbox', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(saveEntryRef, createText(userId, {sourceMessageId: 1}))
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'tag', entryId: entry.entryId})

    const result = await t.mutation(cancelTagFlowRef, {userId, chatId: 2001, entryId: entry.entryId})
    const savedEntry = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))

    expect(result).toEqual({
      status: 'cancelled',
      flowId: flow.flowId,
      entryId: entry.entryId,
    })
    expect(savedEntry?.status).toBe('inbox')
    expect(savedFlow?.status).toBe('cancelled')
  })

  test('completing a description flow stores user description and switches to tag flow', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)
    const entry = await t.mutation(
      saveEntryRef,
      createText(userId, {
        sourceMessageId: 88,
        kind: 'photo',
        text: null,
        description: null,
        descriptionSource: 'none',
        telegram: createTelegram({
          type: 'message:photo',
          file: {
            fileId: 'photo-file',
            fileUniqueId: 'photo-unique',
            fileName: null,
            mimeType: null,
            fileSize: 1000,
            duration: null,
            width: 1280,
            height: 720,
            emoji: null,
            setName: null,
            isAnimated: null,
            isVideo: null,
          },
        }),
      }),
    )
    const flow = await t.mutation(upsertFlowRef, {userId, chatId: 2001, kind: 'description', entryId: entry.entryId})

    const result = await t.mutation(completeDescriptionFlowRef, {userId, chatId: 2001, description: 'photo of monitor adapter'})
    const savedEntry = await t.run((ctx) => ctx.db.get(entry.entryId))
    const savedFlow = await t.run((ctx) => ctx.db.get(flow.flowId))

    expect(result).toEqual({
      status: 'described',
      flowId: flow.flowId,
      entryId: entry.entryId,
      description: 'photo of monitor adapter',
    })
    expect(savedEntry?.description).toBe('photo of monitor adapter')
    expect(savedEntry?.descriptionSource).toBe('user')
    expect(savedEntry?.status).toBe('inbox')
    expect(savedFlow?.kind).toBe('tag')
    expect(savedFlow?.status).toBe('active')
  })
})
