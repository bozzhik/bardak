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

type BotEventContext = {
  updateId: number | null
  messageId: number | null
  textLength: number | null
  errorName: string | null
  reason: string | null
}

type RecordBotEventArgs = {
  userId?: Id<'users'> | null
  telegramId?: number | null
  chatId?: number | null
  chatKind?: 'bot' | 'group' | 'supergroup' | null
  kind: 'command' | 'message' | 'flow' | 'entry' | 'error' | 'system'
  action: string
  status: 'ok' | 'ignored' | 'rejected' | 'error'
  command?: string | null
  messageKind?: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported' | null
  entryId?: Id<'entries'> | null
  flowId?: Id<'flows'> | null
  context?: BotEventContext
}

type RecordBotEventResult = {
  eventId: Id<'botEvents'>
}

type ListByUserArgs = {
  userId: Id<'users'>
  limit?: number
}

type BotEventRow = {
  userId: Id<'users'> | null
  telegramId: number | null
  chatId: number | null
  chatKind: 'bot' | 'group' | 'supergroup' | null
  source: 'telegram'
  kind: 'command' | 'message' | 'flow' | 'entry' | 'error' | 'system'
  action: string
  status: 'ok' | 'ignored' | 'rejected' | 'error'
  command: string | null
  messageKind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported' | null
  entryId: Id<'entries'> | null
  flowId: Id<'flows'> | null
  context: BotEventContext
  createdAt: number
}

type ListByUserResult = BotEventRow[]

type ListByTelegramArgs = {
  telegramId: number
  limit?: number
}

type ListByTelegramResult = BotEventRow[]

const registerUserRef = makeFunctionReference<'mutation', RegisterUserArgs, RegisterUserResult>('tables/users:registerFromTelegramStart')
const recordBotEventRef = makeFunctionReference<'mutation', RecordBotEventArgs, RecordBotEventResult>('tables/botEvents:record')
const listBotEventsByUserRef = makeFunctionReference<'query', ListByUserArgs, ListByUserResult>('tables/botEvents:listByUser')
const listBotEventsByTelegramRef = makeFunctionReference<'query', ListByTelegramArgs, ListByTelegramResult>('tables/botEvents:listByTelegram')

const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/botEvents.ts': () => import('./botEvents'),
  '../tables/users.ts': () => import('./users'),
}

async function createUser(t: ReturnType<typeof convexTest>): Promise<Id<'users'>> {
  const result = await t.mutation(registerUserRef, {
    telegramId: 42,
    chatId: 420,
    chatKind: 'bot',
    isBotAccount: false,
    username: 'tester',
    firstName: 'Test',
    lastName: null,
    languageCode: 'en',
    isPremium: null,
    timezone: null,
    locale: 'en',
    startPayload: null,
    registrationSource: 'telegram_start',
  })

  return result.userId
}

describe('bot events data model', () => {
  test('records a compact append-only user activity event', async () => {
    const t = convexTest(schema, modules)
    const userId = await createUser(t)

    const result = await t.mutation(recordBotEventRef, {
      userId,
      telegramId: 42,
      chatId: 420,
      chatKind: 'bot',
      kind: 'command',
      action: 'start',
      status: 'ok',
      command: '/start',
      context: {
        updateId: 100,
        messageId: 200,
        textLength: 14,
        errorName: null,
        reason: null,
      },
    })

    const rows = await t.query(listBotEventsByUserRef, {userId})

    expect(result.eventId).toBeString()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      userId,
      telegramId: 42,
      chatId: 420,
      chatKind: 'bot',
      source: 'telegram',
      kind: 'command',
      action: 'start',
      status: 'ok',
      command: '/start',
      messageKind: null,
      entryId: null,
      flowId: null,
      context: {
        updateId: 100,
        messageId: 200,
        textLength: 14,
        errorName: null,
        reason: null,
      },
    })
  })

  test('records rejected activity even before a user row exists', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(recordBotEventRef, {
      telegramId: 999,
      chatId: 1000,
      chatKind: 'group',
      kind: 'message',
      action: 'group_message',
      status: 'rejected',
      messageKind: 'text',
      context: {
        updateId: null,
        messageId: 77,
        textLength: 5,
        errorName: null,
        reason: 'private_only',
      },
    })

    const rows = await t.query(listBotEventsByTelegramRef, {telegramId: 999})

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBeNull()
    expect(rows[0]?.status).toBe('rejected')
    expect(rows[0]?.context.reason).toBe('private_only')
  })
})
