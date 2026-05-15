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

const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const ensureTagRef = makeFunctionReference<'mutation', EnsureTagArgs, EnsureTagResult>('tables/tags:ensure')
const listTagsRef = makeFunctionReference<'query', ListTagsArgs, ListTagsResult>('tables/tags:listByUser')
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
})
