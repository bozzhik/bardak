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

type TouchCommandResult =
  | {
      status: 'updated'
      userId: Id<'users'>
    }
  | {
      status: 'not_registered'
    }

type UserIdentityArgs = Omit<RegisterUserArgs, 'startPayload' | 'registrationSource'>

const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const touchCommandRef = makeFunctionReference<'mutation', UserIdentityArgs, TouchCommandResult>('tables/users:touchFromTelegramCommand')
const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/users.ts': () => import('./users'),
}

function createRegisterArgs(overrides: Partial<RegisterUserArgs> = {}): RegisterUserArgs {
  return {
    telegramId: 42,
    chatId: 420,
    chatKind: 'bot',
    isBotAccount: false,
    username: 'bardak_user',
    firstName: 'Bar',
    lastName: 'Dak',
    languageCode: 'ru',
    isPremium: true,
    timezone: null,
    locale: 'ru',
    startPayload: 'start',
    registrationSource: 'telegram_start',
    ...overrides,
  }
}

function createIdentityArgs(overrides: Partial<UserIdentityArgs> = {}): UserIdentityArgs {
  const args = createRegisterArgs(overrides)
  return {
    telegramId: args.telegramId,
    chatId: args.chatId,
    chatKind: args.chatKind,
    isBotAccount: args.isBotAccount,
    username: args.username,
    firstName: args.firstName,
    lastName: args.lastName,
    languageCode: args.languageCode,
    isPremium: args.isPremium,
    timezone: args.timezone,
    locale: args.locale,
  }
}

describe('users data model', () => {
  test('stores indexed identity fields at top level and groups profile/settings/telegram/stats', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(registerUserRef, createRegisterArgs())
    const user = await t.run((ctx) => ctx.db.get(result.userId))

    expect(result.status).toBe('created')
    expect(user).toMatchObject({
      telegramId: 42,
      username: 'bardak_user',
      botChatId: 420,
      webAuthId: null,
      status: 'active',
      profile: {
        firstName: 'Bar',
        lastName: 'Dak',
        languageCode: 'ru',
        isPremium: true,
        isBot: false,
      },
      settings: {
        timezone: null,
        locale: 'ru',
      },
      telegram: {
        lastChatId: 420,
        lastChatKind: 'bot',
        startPayload: 'start',
        registrationSource: 'telegram_start',
      },
      stats: {
        updates: 1,
        commands: 1,
        starts: 1,
        captures: 0,
        errors: 0,
      },
      moderation: {
        blockedAt: null,
        unblockedAt: null,
      },
    })
  })

  test('updates existing user by telegramId without creating duplicates', async () => {
    const t = convexTest(schema, modules)

    const first = await t.mutation(registerUserRef, createRegisterArgs({username: 'first'}))
    const second = await t.mutation(registerUserRef, createRegisterArgs({username: 'second', chatId: 421}))
    const rows = await t.run((ctx) => ctx.db.query('users').take(10))
    const user = await t.run((ctx) => ctx.db.get(first.userId))

    expect(second).toEqual({status: 'updated', userId: first.userId})
    expect(rows).toHaveLength(1)
    expect(user?.username).toBe('second')
    expect(user?.botChatId).toBe(421)
    expect(user?.stats.starts).toBe(2)
  })

  test('touches command usage without counting it as capture', async () => {
    const t = convexTest(schema, modules)
    const first = await t.mutation(registerUserRef, createRegisterArgs())

    const result = await t.mutation(touchCommandRef, createIdentityArgs({username: 'after_command', chatId: 422}))
    const user = await t.run((ctx) => ctx.db.get(first.userId))

    expect(result).toEqual({status: 'updated', userId: first.userId})
    expect(user?.username).toBe('after_command')
    expect(user?.botChatId).toBe(422)
    expect(user?.stats).toMatchObject({
      updates: 2,
      commands: 2,
      starts: 1,
      captures: 0,
    })
  })

  test('touch command returns not_registered for unknown users', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(touchCommandRef, createIdentityArgs())

    expect(result).toEqual({status: 'not_registered'})
  })
})
