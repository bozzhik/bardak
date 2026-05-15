import {describe, expect, test} from 'bun:test'

import type {UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, START_MESSAGE} from '@/bot/messages'
import {createFakeBotDataClient} from '@/convex/fake-client'
import {handleCallback, handleStart, handleTagDelete, handleTagNew, handleTagRename, handleTags, handleText, readStartPayload, tagDeleteCancelCallback, tagDeleteConfirmCallback, tagPickCallback} from '@/bot/flow'

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

  test('text messages without tags offer existing tags as callback buttons', async () => {
    const client = createFakeBotDataClient({
      listTagsResult: [
        {id: 'tags:work', name: 'work', slug: 'work'},
        {id: 'tags:home', name: 'home', slug: 'home'},
      ],
    })

    const result = await handleText({identity: USER, messageId: 100, text: 'hello'}, client)

    expect(result).toEqual({
      type: 'reply',
      text: 'Сохранил во входящие. Напиши тег в формате #example.',
      buttons: [[{text: '#work', data: 'tag:pick:tags:work'}], [{text: '#home', data: 'tag:pick:tags:home'}]],
    })
    expect(client.listTagsCalls).toEqual([{userId: 'users:test', limit: 8}])
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

  test('/tags asks unregistered users to run /start', async () => {
    const client = createFakeBotDataClient({
      touchCommandResult: {status: 'not_registered'},
    })

    const result = await handleTags({identity: USER}, client)

    expect(result).toEqual({type: 'reply', text: NOT_REGISTERED_MESSAGE})
    expect(client.touchCommandCalls).toEqual([USER])
    expect(client.listTagsCalls).toHaveLength(0)
  })

  test('/tags replies with an empty state when user has no tags', async () => {
    const client = createFakeBotDataClient()

    const result = await handleTags({identity: USER}, client)

    expect(result).toEqual({type: 'reply', text: 'Тегов пока нет. Сохрани материал без тега, затем напиши #example.'})
    expect(client.touchCommandCalls).toEqual([USER])
    expect(client.listTagsCalls).toEqual([{userId: 'users:test', limit: 50}])
  })

  test('/tags lists only returned user tags', async () => {
    const client = createFakeBotDataClient({
      listTagsResult: [
        {id: 'tags:work', name: 'work', slug: 'work'},
        {id: 'tags:покупки', name: 'покупки', slug: 'покупки'},
      ],
    })

    const result = await handleTags({identity: USER}, client)

    expect(result).toEqual({type: 'reply', text: ['Твои теги:', '', '#work', '#покупки'].join('\n')})
    expect(client.listTagsCalls).toEqual([{userId: 'users:test', limit: 50}])
  })

  test('/tag_new asks unregistered users to run /start', async () => {
    const client = createFakeBotDataClient({
      touchCommandResult: {status: 'not_registered'},
    })

    const result = await handleTagNew({identity: USER, tag: '#work'}, client)

    expect(result).toEqual({type: 'reply', text: NOT_REGISTERED_MESSAGE})
    expect(client.touchCommandCalls).toEqual([USER])
    expect(client.ensureTagCalls).toHaveLength(0)
  })

  test('/tag_new asks for hashtag format when payload is missing or invalid', async () => {
    const client = createFakeBotDataClient()

    const missing = await handleTagNew({identity: USER, tag: null}, client)
    const invalid = await handleTagNew({identity: USER, tag: 'work'}, client)

    expect(missing).toEqual({type: 'reply', text: 'Напиши тег в формате /tag_new #example.'})
    expect(invalid).toEqual({type: 'reply', text: 'Напиши тег в формате /tag_new #example.'})
    expect(client.touchCommandCalls).toEqual([USER, USER])
    expect(client.ensureTagCalls).toHaveLength(0)
  })

  test('/tag_new creates a normalized tag', async () => {
    const client = createFakeBotDataClient()

    const result = await handleTagNew({identity: USER, tag: '#Work'}, client)

    expect(result).toEqual({type: 'reply', text: 'Создал тег #work.'})
    expect(client.ensureTagCalls).toEqual([{userId: 'users:test', tag: '#Work'}])
  })

  test('/tag_new reports an existing normalized tag without creating a duplicate', async () => {
    const client = createFakeBotDataClient({
      ensureTagResult: {
        status: 'existing',
        tagId: 'tags:work',
      },
    })

    const result = await handleTagNew({identity: USER, tag: '#Work'}, client)

    expect(result).toEqual({type: 'reply', text: 'Тег #work уже есть.'})
    expect(client.ensureTagCalls).toEqual([{userId: 'users:test', tag: '#Work'}])
  })

  test('/tag_rename renames a tag', async () => {
    const client = createFakeBotDataClient()

    const result = await handleTagRename({identity: USER, payload: '#Work #Home'}, client)

    expect(result).toEqual({type: 'reply', text: 'Переименовал #work в #home.'})
    expect(client.renameTagCalls).toEqual([{userId: 'users:test', fromTag: '#Work', toTag: '#Home'}])
  })

  test('/tag_rename rejects missing, invalid, and duplicate target tags', async () => {
    const invalidClient = createFakeBotDataClient()
    const duplicateClient = createFakeBotDataClient({
      renameTagResult: {status: 'target_exists'},
    })

    const missing = await handleTagRename({identity: USER, payload: null}, invalidClient)
    const invalid = await handleTagRename({identity: USER, payload: '#old new'}, invalidClient)
    const duplicate = await handleTagRename({identity: USER, payload: '#old #new'}, duplicateClient)

    expect(missing).toEqual({type: 'reply', text: 'Напиши в формате /tag_rename #old #new.'})
    expect(invalid).toEqual({type: 'reply', text: 'Напиши в формате /tag_rename #old #new.'})
    expect(duplicate).toEqual({type: 'reply', text: 'Тег #new уже есть.'})
    expect(invalidClient.renameTagCalls).toHaveLength(0)
    expect(duplicateClient.renameTagCalls).toEqual([{userId: 'users:test', fromTag: '#old', toTag: '#new'}])
  })

  test('/tag_delete asks for confirmation with callback buttons', async () => {
    const client = createFakeBotDataClient({
      findTagResult: {status: 'found', tag: {id: 'tags:work', name: 'work', slug: 'work'}},
    })

    const result = await handleTagDelete({identity: USER, tag: '#Work'}, client)

    expect(result).toEqual({
      type: 'reply',
      text: 'Удалить тег #work? Материалы останутся.',
      buttons: [
        [
          {text: 'Удалить', data: 'tag:delete:confirm:tags:work'},
          {text: 'Отмена', data: 'tag:delete:cancel:tags:work'},
        ],
      ],
    })
    expect(client.findTagCalls).toEqual([{userId: 'users:test', tag: '#Work'}])
  })

  test('/tag_delete rejects invalid or missing tags', async () => {
    const client = createFakeBotDataClient({
      findTagResult: {status: 'missing'},
    })

    const invalid = await handleTagDelete({identity: USER, tag: 'work'}, client)
    const missing = await handleTagDelete({identity: USER, tag: '#work'}, client)

    expect(invalid).toEqual({type: 'reply', text: 'Напиши в формате /tag_delete #tag.'})
    expect(missing).toEqual({type: 'reply', text: 'Тег #work не найден.'})
    expect(client.findTagCalls).toEqual([{userId: 'users:test', tag: '#work'}])
  })

  test('tag pick callback attaches a tag to the active flow', async () => {
    const client = createFakeBotDataClient({
      completeTagFlowByIdResult: {
        status: 'tagged',
        flowId: 'flows:test',
        entryId: 'entries:test',
        tagId: 'tags:work',
        tagName: 'work',
      },
    })

    const result = await handleCallback({identity: USER, data: tagPickCallback('tags:work')}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил с тегом #work.'})
    expect(client.completeTagFlowByIdCalls).toEqual([{userId: 'users:test', chatId: 420, tagId: 'tags:work'}])
  })

  test('tag delete callbacks confirm or cancel deletion', async () => {
    const confirmClient = createFakeBotDataClient({
      removeTagResult: {status: 'deleted', tagName: 'work', linkCount: 2},
    })
    const cancelClient = createFakeBotDataClient()

    const confirmed = await handleCallback({identity: USER, data: tagDeleteConfirmCallback('tags:work')}, confirmClient)
    const cancelled = await handleCallback({identity: USER, data: tagDeleteCancelCallback('tags:work')}, cancelClient)

    expect(confirmed).toEqual({type: 'reply', text: 'Удалил тег #work.'})
    expect(cancelled).toEqual({type: 'reply', text: 'Оставил тег.'})
    expect(confirmClient.removeTagCalls).toEqual([{userId: 'users:test', tagId: 'tags:work'}])
    expect(cancelClient.removeTagCalls).toHaveLength(0)
  })
})
