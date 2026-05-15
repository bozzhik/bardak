import {describe, expect, test} from 'bun:test'

import type {UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, START_MESSAGE} from '@/bot/messages'
import {createFakeBotDataClient} from '@/convex/fake-client'
import {handleStart, handleText, readStartPayload} from '@/bot/flow'

const USER: UserIdentityPayload = {
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
}

describe('bot flow', () => {
  test('reads a trimmed /start payload', () => {
    expect(readStartPayload('  invite_123  ')).toBe('invite_123')
    expect(readStartPayload('   ')).toBeNull()
    expect(readStartPayload(undefined)).toBeNull()
  })

  test('/start rejects missing user or chat context', async () => {
    const client = createFakeBotDataClient()

    const result = await handleStart({identity: null, startPayload: null}, client)

    expect(result).toEqual({type: 'reply', text: INVALID_CONTEXT_MESSAGE})
    expect(client.registerCalls).toHaveLength(0)
  })

  test('/start rejects bot accounts', async () => {
    const client = createFakeBotDataClient()

    const result = await handleStart({identity: {...USER, isBotAccount: true}, startPayload: null}, client)

    expect(result).toEqual({type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE})
    expect(client.registerCalls).toHaveLength(0)
  })

  test('/start registers the user and replies with onboarding text', async () => {
    const client = createFakeBotDataClient()

    const result = await handleStart({identity: USER, startPayload: 'invite_123'}, client)

    expect(result).toEqual({type: 'reply', text: START_MESSAGE})
    expect(client.registerCalls).toEqual([
      {
        ...USER,
        startPayload: 'invite_123',
        registrationSource: 'telegram_start',
      },
    ])
  })

  test('text commands are ignored as capturable messages', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: USER, messageId: 1, text: '/start again'}, client)

    expect(result).toEqual({type: 'ignored_command', command: '/start'})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages reject missing user or chat context', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: null, messageId: 1, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: INVALID_CONTEXT_MESSAGE})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages reject bot accounts', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: {...USER, isBotAccount: true}, messageId: 1, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages ask unregistered users to run /start', async () => {
    const client = createFakeBotDataClient({
      touchResult: {status: 'not_registered'},
    })

    const result = await handleText({identity: USER, messageId: 1, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: NOT_REGISTERED_MESSAGE})
    expect(client.touchCalls).toEqual([USER])
    expect(client.saveEntryCalls).toHaveLength(0)
  })

  test('text messages without tags save an inbox entry and start tag flow', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: USER, messageId: 100, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил во входящие. Напиши тег в формате #example.'})
    expect(client.touchCalls).toEqual([USER])
    expect(client.saveEntryCalls).toEqual([
      {
        userId: 'users:test',
        sourceChatId: 420,
        sourceMessageId: 100,
        kind: 'text',
        text: 'hello',
        description: null,
        descriptionSource: 'text',
        url: null,
        tags: [],
      },
    ])
    expect(client.upsertFlowCalls).toEqual([
      {
        userId: 'users:test',
        chatId: 420,
        kind: 'tag',
        entryId: 'entries:test',
      },
    ])
    expect(client.completeTagFlowCalls).toEqual([
      {
        userId: 'users:test',
        chatId: 420,
        tags: [],
      },
    ])
  })

  test('text messages with inline tags save a tagged entry without tag flow', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: USER, messageId: 101, text: 'купить переходник #покупки #work'}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил с тегами #покупки #work.'})
    expect(client.saveEntryCalls).toEqual([
      {
        userId: 'users:test',
        sourceChatId: 420,
        sourceMessageId: 101,
        kind: 'text',
        text: 'купить переходник #покупки #work',
        description: null,
        descriptionSource: 'text',
        url: null,
        tags: ['#покупки', '#work'],
      },
    ])
    expect(client.upsertFlowCalls).toHaveLength(0)
  })

  test('active tag flow consumes the next hashtag message instead of saving a new entry', async () => {
    const client = createFakeBotDataClient({
      completeTagFlowResult: {
        status: 'tagged',
        flowId: 'flows:test',
        entryId: 'entries:test',
        tagIds: ['tags:test'],
      },
    })

    const result = await handleText({identity: USER, messageId: 102, text: '#покупки'}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил с тегом #покупки.'})
    expect(client.completeTagFlowCalls).toEqual([
      {
        userId: 'users:test',
        chatId: 420,
        tags: ['#покупки'],
      },
    ])
    expect(client.saveEntryCalls).toHaveLength(0)
    expect(client.upsertFlowCalls).toHaveLength(0)
  })

  test('active tag flow asks for hashtag format instead of saving invalid tag text', async () => {
    const client = createFakeBotDataClient({
      completeTagFlowResult: {
        status: 'invalid_tag',
        flowId: 'flows:test',
        entryId: 'entries:test',
      },
    })

    const result = await handleText({identity: USER, messageId: 103, text: 'покупки'}, client)

    expect(result).toEqual({type: 'reply', text: 'Напиши тег в формате #example.'})
    expect(client.completeTagFlowCalls).toEqual([
      {
        userId: 'users:test',
        chatId: 420,
        tags: [],
      },
    ])
    expect(client.saveEntryCalls).toHaveLength(0)
    expect(client.upsertFlowCalls).toHaveLength(0)
  })
})
