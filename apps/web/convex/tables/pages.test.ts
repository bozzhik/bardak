import {describe, expect, test} from 'bun:test'
import {convexTest} from 'convex-test'
import {makeFunctionReference} from 'convex/server'

import type {Id} from '../_generated/dataModel'
import schema from '../schema'

type EntryKind = 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'

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

type SaveEntryArgs = {
  userId: Id<'users'>
  sourceChatId: number
  sourceMessageId: number
  kind: EntryKind
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

type ArchiveEntryBySourceMessageArgs = {
  userId: Id<'users'>
  sourceChatId: number
  sourceMessageId: number
}

type ArchiveEntryBySourceMessageResult = {status: 'missing'} | {status: 'archived'; entryId: Id<'entries'>}

type CreatePageFromTagArgs = {
  userId: Id<'users'>
  tag: string
}

type CreatePageFromTagResult =
  | {
      status: 'created' | 'existing'
      pageId: Id<'pages'>
      shareSlug: string
      title: string
      activeEntryCount: number
    }
  | {
      status: 'invalid_tag' | 'missing_tag' | 'empty_tag'
    }

type PublicPageResult =
  | {
      status: 'missing'
    }
  | {
      status: 'found'
      page: {
        id: Id<'pages'>
        title: string
        shareSlug: string
        createdAt: number
      }
      owner: {
        username: string | null
      }
      tag: {
        name: string
        slug: string
      }
      entries: Array<{
        id: Id<'entries'>
        kind: EntryKind
        text: string | null
        description: string | null
        url: string | null
        createdAt: number
        telegram: SaveEntryArgs['telegram']
      }>
      isTruncated: boolean
    }

const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const saveEntryRef = makeFunctionReference<'mutation', SaveEntryArgs, SaveEntryResult>('tables/entries:save')
const archiveEntryBySourceMessageRef = makeFunctionReference<'mutation', ArchiveEntryBySourceMessageArgs, ArchiveEntryBySourceMessageResult>('tables/entries:archiveBySourceMessage')
const createPageFromTagRef = makeFunctionReference<'mutation', CreatePageFromTagArgs, CreatePageFromTagResult>('tables/pages:createFromTag')
const getPublicPageRef = makeFunctionReference<'query', {shareSlug: string}, PublicPageResult>('tables/pages:getPublicBySlug')

const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/entries.ts': () => import('./entries'),
  '../tables/pages.ts': () => import('./pages'),
  '../tables/users.ts': () => import('./users'),
}

function registerArgs(telegramId: number, username: string | null): RegisterUserArgs {
  return {
    telegramId,
    chatId: telegramId + 1000,
    chatKind: 'bot',
    isBotAccount: false,
    username,
    firstName: 'Share',
    lastName: null,
    languageCode: 'ru',
    isPremium: null,
    timezone: null,
    locale: 'ru',
    startPayload: null,
    registrationSource: 'telegram_start',
  }
}

async function createUser(t: ReturnType<typeof convexTest>, telegramId: number, username: string | null): Promise<Id<'users'>> {
  const result = await t.mutation(registerUserRef, registerArgs(telegramId, username))
  return result.userId
}

function entry(userId: Id<'users'>, sourceMessageId: number, overrides: Partial<SaveEntryArgs> = {}): SaveEntryArgs {
  return {
    userId,
    sourceChatId: 2001,
    sourceMessageId,
    kind: 'text',
    text: `entry ${sourceMessageId}`,
    description: null,
    url: null,
    tags: ['#work'],
    ...overrides,
  }
}

describe('pages data model', () => {
  test('creates one published live page per user tag and returns the existing page on repeat', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001, 'bozzhik')
    await t.mutation(saveEntryRef, entry(userId, 1))

    const created = await t.mutation(createPageFromTagRef, {userId, tag: '#work'})
    const existing = await t.mutation(createPageFromTagRef, {userId, tag: '#work'})

    expect(created).toMatchObject({
      status: 'created',
      title: '#work',
      activeEntryCount: 1,
    })
    if (created.status !== 'created') throw new Error('expected page creation')
    expect(created.shareSlug).toMatch(/^[a-zA-Z0-9_-]{10,16}$/)
    expect(existing).toEqual({...created, status: 'existing'})
  })

  test('requires an existing tag with active entries', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001, 'bozzhik')
    const saved = await t.mutation(saveEntryRef, entry(userId, 1, {tags: ['#empty']}))
    await t.mutation(archiveEntryBySourceMessageRef, {userId, sourceChatId: 2001, sourceMessageId: 1})

    expect(saved.entryStatus).toBe('saved')
    expect(await t.mutation(createPageFromTagRef, {userId, tag: 'work'})).toEqual({status: 'invalid_tag'})
    expect(await t.mutation(createPageFromTagRef, {userId, tag: '#missing'})).toEqual({status: 'missing_tag'})
    expect(await t.mutation(createPageFromTagRef, {userId, tag: '#empty'})).toEqual({status: 'empty_tag'})
  })

  test('republishes an archived page when the user asks for the tag again', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001, 'bozzhik')
    await t.mutation(saveEntryRef, entry(userId, 1))
    const created = await t.mutation(createPageFromTagRef, {userId, tag: '#work'})
    if (created.status !== 'created') throw new Error('expected page creation')
    await t.run(async (ctx) => {
      await ctx.db.patch(created.pageId, {
        status: 'archived',
        archivedAt: 10,
      })
    })

    const existing = await t.mutation(createPageFromTagRef, {userId, tag: '#work'})
    const publicPage = existing.status === 'existing' ? await t.query(getPublicPageRef, {shareSlug: existing.shareSlug}) : null

    expect(existing).toMatchObject({
      status: 'existing',
      pageId: created.pageId,
      shareSlug: created.shareSlug,
    })
    expect(publicPage?.status).toBe('found')
  })

  test('public page reads only published owner entries for the tag newest first', async () => {
    const t = convexTest(schema, modules)
    const ownerId = await createUser(t, 1001, 'bozzhik')
    const otherUserId = await createUser(t, 1002, 'other')
    const oldEntry = await t.mutation(saveEntryRef, entry(ownerId, 1, {text: 'old'}))
    const newEntry = await t.mutation(saveEntryRef, entry(ownerId, 2, {kind: 'document', text: null, description: 'brief', descriptionSource: 'caption', telegram: {type: 'message:document', context: {forwardOrigin: null, forwardDate: null, replyToMessageId: null}, file: {fileId: 'file-id', fileUniqueId: 'file-unique', fileName: 'brief.pdf', mimeType: 'application/pdf', fileSize: 2048, duration: null, width: null, height: null, emoji: null, setName: null, isAnimated: null, isVideo: null}}}))
    const archivedEntry = await t.mutation(saveEntryRef, entry(ownerId, 3, {text: 'archived'}))
    await t.mutation(saveEntryRef, entry(otherUserId, 4, {text: 'foreign'}))
    await t.mutation(archiveEntryBySourceMessageRef, {userId: ownerId, sourceChatId: 2001, sourceMessageId: 3})
    const page = await t.mutation(createPageFromTagRef, {userId: ownerId, tag: '#work'})
    if (page.status !== 'created') throw new Error('expected page creation')

    const result = await t.query(getPublicPageRef, {shareSlug: page.shareSlug})

    expect(result.status).toBe('found')
    if (result.status !== 'found') throw new Error('expected public page')
    expect(result.owner).toEqual({username: 'bozzhik'})
    expect(result.tag).toEqual({name: 'work', slug: 'work'})
    expect(result.entries.map((item) => item.id)).toEqual([newEntry.entryId, oldEntry.entryId])
    expect(result.entries.map((item) => item.id)).not.toContain(archivedEntry.entryId)
    expect(result.entries[0]).toMatchObject({
      kind: 'document',
      description: 'brief',
      telegram: {
        file: {
          fileName: 'brief.pdf',
          mimeType: 'application/pdf',
          fileSize: 2048,
        },
      },
    })
  })

  test('public page hides archived pages and truncates after 100 entries', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001, 'bozzhik')
    for (let index = 0; index < 101; index += 1) {
      await t.mutation(saveEntryRef, entry(userId, index + 1, {text: `entry ${index + 1}`}))
    }
    const page = await t.mutation(createPageFromTagRef, {userId, tag: '#work'})
    if (page.status !== 'created') throw new Error('expected page creation')

    const visible = await t.query(getPublicPageRef, {shareSlug: page.shareSlug})
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('pages')
        .withIndex('by_shareSlug', (q) => q.eq('shareSlug', page.shareSlug))
        .unique()
      if (row !== null) await ctx.db.patch(row._id, {status: 'archived'})
    })
    const archived = await t.query(getPublicPageRef, {shareSlug: page.shareSlug})

    expect(visible.status).toBe('found')
    if (visible.status !== 'found') throw new Error('expected public page')
    expect(visible.entries).toHaveLength(100)
    expect(visible.entries[0]?.text).toBe('entry 101')
    expect(visible.isTruncated).toBe(true)
    expect(archived).toEqual({status: 'missing'})
  })
})
