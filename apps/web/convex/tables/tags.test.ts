import {describe, expect, test} from 'bun:test'
import {convexTest} from 'convex-test'
import {makeFunctionReference} from 'convex/server'

import type {Id} from '../_generated/dataModel'
import schema from '../schema'

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

type EnsureTagArgs = {
  userId: Id<'users'>
  tag: string
}

type EnsureTagResult =
  | {
      status: 'created' | 'existing'
      tagId: Id<'tags'>
    }
  | {
      status: 'invalid'
    }

type ListTagsArgs = {
  userId: Id<'users'>
  limit?: number
}

type ListTagsResult = Array<{
  _id: Id<'tags'>
  _creationTime: number
  userId: Id<'users'>
  name: string
  slug: string
  createdAt: number
  updatedAt: number
}>

type RenameTagArgs = {
  userId: Id<'users'>
  fromTag: string
  toTag: string
}

type RenameTagResult =
  | {
      status: 'renamed'
      tagId: Id<'tags'>
      name: string
      slug: string
    }
  | {
      status: 'source_missing' | 'target_exists' | 'invalid'
    }

type FindTagArgs = {
  userId: Id<'users'>
  tag: string
}

type FindTagResult =
  | {
      status: 'found'
      tag: {
        id: Id<'tags'>
        name: string
        slug: string
      }
    }
  | {
      status: 'missing' | 'invalid'
    }

type RemoveTagArgs = {
  userId: Id<'users'>
  tagId: Id<'tags'>
}

type RemoveTagResult =
  | {
      status: 'deleted'
      tagName: string
      linkCount: number
    }
  | {
      status: 'missing'
    }

const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const ensureTagRef = makeFunctionReference<'mutation', EnsureTagArgs, EnsureTagResult>('tables/tags:ensure')
const listTagsRef = makeFunctionReference<'query', ListTagsArgs, ListTagsResult>('tables/tags:listByUser')
const renameTagRef = makeFunctionReference<'mutation', RenameTagArgs, RenameTagResult>('tables/tags:rename')
const findTagRef = makeFunctionReference<'query', FindTagArgs, FindTagResult>('tables/tags:findBySlug')
const removeTagRef = makeFunctionReference<'mutation', RemoveTagArgs, RemoveTagResult>('tables/tags:removeForUser')
const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/tags.ts': () => import('./tags'),
  '../tables/users.ts': () => import('./users'),
}

function createRegisterArgs(telegramId: number): RegisterUserArgs {
  return {
    telegramId,
    chatId: telegramId * 10,
    chatKind: 'bot',
    isBotAccount: false,
    username: `user_${telegramId}`,
    firstName: 'Tag',
    lastName: null,
    languageCode: 'ru',
    isPremium: null,
    timezone: null,
    locale: 'ru',
    startPayload: null,
    registrationSource: 'telegram_start',
  }
}

async function createUser(t: ReturnType<typeof convexTest>, telegramId: number): Promise<Id<'users'>> {
  const result = await t.mutation(registerUserRef, createRegisterArgs(telegramId))
  return result.userId
}

describe('tags data model', () => {
  test('ensure normalizes duplicate slugs per user', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001)

    const first = await t.mutation(ensureTagRef, {userId, tag: '#Work'})
    const second = await t.mutation(ensureTagRef, {userId, tag: '#work'})
    const tags = await t.run((ctx) =>
      ctx.db
        .query('tags')
        .withIndex('by_userId_and_slug', (q) => q.eq('userId', userId).eq('slug', 'work'))
        .take(10),
    )

    expect(first.status).toBe('created')
    if (first.status !== 'created') throw new Error('expected first tag creation')
    expect(second).toEqual({status: 'existing', tagId: first.tagId})
    expect(tags).toHaveLength(1)
    expect(tags[0]?.name).toBe('work')
  })

  test('ensure rejects invalid tag names', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001)

    const result = await t.mutation(ensureTagRef, {userId, tag: 'work'})
    const tags = await t.run((ctx) => ctx.db.query('tags').take(10))

    expect(result).toEqual({status: 'invalid'})
    expect(tags).toHaveLength(0)
  })

  test('lists only tags owned by the requested user', async () => {
    const t = convexTest(schema, modules)
    const firstUserId = await createUser(t, 1001)
    const secondUserId = await createUser(t, 1002)

    await t.mutation(ensureTagRef, {userId: firstUserId, tag: '#work'})
    await t.mutation(ensureTagRef, {userId: secondUserId, tag: '#private'})
    await t.mutation(ensureTagRef, {userId: firstUserId, tag: '#покупки'})

    const tags = await t.query(listTagsRef, {userId: firstUserId, limit: 10})

    expect(tags.map((tag) => tag.slug).sort()).toEqual(['work', 'покупки'])
    expect(tags.every((tag) => tag.userId === firstUserId)).toBe(true)
  })

  test('list respects the requested limit', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001)

    await t.mutation(ensureTagRef, {userId, tag: '#one'})
    await t.mutation(ensureTagRef, {userId, tag: '#two'})

    const tags = await t.query(listTagsRef, {userId, limit: 1})

    expect(tags).toHaveLength(1)
  })

  test('renames a tag without allowing duplicate target slugs', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001)
    const first = await t.mutation(ensureTagRef, {userId, tag: '#work'})
    await t.mutation(ensureTagRef, {userId, tag: '#home'})
    if (first.status === 'invalid') throw new Error('expected tag creation')

    const duplicate = await t.mutation(renameTagRef, {userId, fromTag: '#work', toTag: '#Home'})
    const renamed = await t.mutation(renameTagRef, {userId, fromTag: '#work', toTag: '#ideas'})
    const oldLookup = await t.query(findTagRef, {userId, tag: '#work'})
    const newLookup = await t.query(findTagRef, {userId, tag: '#ideas'})

    expect(duplicate).toEqual({status: 'target_exists'})
    expect(renamed).toEqual({
      status: 'renamed',
      tagId: first.tagId,
      name: 'ideas',
      slug: 'ideas',
    })
    expect(oldLookup).toEqual({status: 'missing'})
    expect(newLookup).toMatchObject({status: 'found', tag: {name: 'ideas', slug: 'ideas'}})
  })

  test('remove deletes tag links but keeps entries', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t, 1001)
    const tag = await t.mutation(ensureTagRef, {userId, tag: '#work'})
    if (tag.status !== 'created') throw new Error('expected tag creation')
    const entryId = await t.run((ctx) =>
      ctx.db.insert('entries', {
        userId,
        source: 'telegram',
        sourceChatId: 10010,
        sourceMessageId: 1,
        kind: 'text',
        status: 'saved',
        text: 'hello',
        description: null,
        descriptionSource: 'text',
        url: null,
        telegram: {
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
        },
        createdAt: 1,
        updatedAt: 1,
        archivedAt: null,
      }),
    )
    await t.run((ctx) => ctx.db.insert('entryTags', {userId, entryId, tagId: tag.tagId, createdAt: 1}))

    const result = await t.mutation(removeTagRef, {userId, tagId: tag.tagId})
    const entry = await t.run((ctx) => ctx.db.get(entryId))
    const links = await t.run((ctx) =>
      ctx.db
        .query('entryTags')
        .withIndex('by_userId_and_tagId', (q) => q.eq('userId', userId).eq('tagId', tag.tagId))
        .take(10),
    )
    const removed = await t.run((ctx) => ctx.db.get(tag.tagId))

    expect(result).toEqual({status: 'deleted', tagName: 'work', linkCount: 1})
    expect(entry).not.toBeNull()
    expect(entry?.status).toBe('inbox')
    expect(links).toHaveLength(0)
    expect(removed).toBeNull()
  })
})
