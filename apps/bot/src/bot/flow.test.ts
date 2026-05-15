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

    const result = await handleText({identity: USER, text: '/start again'}, client)

    expect(result).toEqual({type: 'ignored_command', command: '/start'})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages reject missing user or chat context', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: null, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: INVALID_CONTEXT_MESSAGE})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages reject bot accounts', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: {...USER, isBotAccount: true}, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE})
    expect(client.touchCalls).toHaveLength(0)
  })

  test('text messages ask unregistered users to run /start', async () => {
    const client = createFakeBotDataClient({
      touchResult: {status: 'not_registered'},
    })

    const result = await handleText({identity: USER, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: NOT_REGISTERED_MESSAGE})
    expect(client.touchCalls).toEqual([USER])
  })

  test('text messages return the current draft reply for registered users', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: USER, text: 'hello'}, client)

    expect(result).toEqual({type: 'reply', text: 'hello'})
    expect(client.touchCalls).toEqual([USER])
  })
})
