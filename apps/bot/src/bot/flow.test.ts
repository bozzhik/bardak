import {describe, expect, test} from 'bun:test'

import type {UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, START_MESSAGE} from '@/bot/messages'
import {createFakeBotDataClient} from '@/convex/fake-client'
import {handleCallback, handleInbox, handleInboxCount, handleMessage, handleStart, handleTagDelete, handleTagNew, handleTagRename, handleTags, handleText, inboxSkipCallback, readStartPayload, tagDeleteCancelCallback, tagDeleteConfirmCallback, tagPickCallback} from '@/bot/flow'
import type {NormalizedEntryMessage} from '@/telegram/normalize'

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

const PHOTO_MESSAGE: NormalizedEntryMessage = {
  messageId: 500,
  kind: 'photo',
  text: null,
  description: null,
  descriptionSource: 'none',
  url: null,
  telegram: {
    type: 'message:photo',
    context: {
      forwardOrigin: null,
      forwardDate: null,
      replyToMessageId: null,
    },
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
  },
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

  test('text messages with a URL save a link entry with the first URL', async () => {
    const client = createFakeBotDataClient()

    const result = await handleText({identity: USER, messageId: 104, text: 'read https://example.com/a #read'}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил с тегом #read.'})
    expect(client.saveEntryCalls).toEqual([
      {
        userId: 'users:test',
        sourceChatId: 420,
        sourceMessageId: 104,
        kind: 'link',
        text: 'read https://example.com/a #read',
        description: null,
        descriptionSource: 'text',
        url: 'https://example.com/a',
        tags: ['#read'],
      },
    ])
  })

  test('photo without caption saves metadata and starts description flow', async () => {
    const client = createFakeBotDataClient()

    const result = await handleMessage({identity: USER, message: PHOTO_MESSAGE}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил во входящие. Опиши материал несколькими словами, чтобы я мог найти его позже.'})
    expect(client.saveEntryCalls).toEqual([
      {
        userId: 'users:test',
        sourceChatId: 420,
        sourceMessageId: 500,
        kind: 'photo',
        text: null,
        description: null,
        descriptionSource: 'none',
        url: null,
        tags: [],
        telegram: PHOTO_MESSAGE.telegram,
      },
    ])
    expect(client.upsertFlowCalls).toEqual([{userId: 'users:test', chatId: 420, kind: 'description', entryId: 'entries:test'}])
  })

  test('photo with caption saves description and starts tag flow', async () => {
    const client = createFakeBotDataClient()
    const message: NormalizedEntryMessage = {
      ...PHOTO_MESSAGE,
      messageId: 501,
      description: 'receipt from hardware store',
      descriptionSource: 'caption',
    }

    const result = await handleMessage({identity: USER, message}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил во входящие. Напиши тег в формате #example.'})
    expect(client.saveEntryCalls).toMatchObject([
      {
        sourceMessageId: 501,
        kind: 'photo',
        description: 'receipt from hardware store',
        descriptionSource: 'caption',
        tags: [],
      },
    ])
    expect(client.upsertFlowCalls).toEqual([{userId: 'users:test', chatId: 420, kind: 'tag', entryId: 'entries:test'}])
  })

  test('media caption with inline tags saves without follow-up flow', async () => {
    const client = createFakeBotDataClient()
    const message: NormalizedEntryMessage = {
      ...PHOTO_MESSAGE,
      messageId: 502,
      description: 'receipt #tax',
      descriptionSource: 'caption',
    }

    const result = await handleMessage({identity: USER, message}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил с тегом #tax.'})
    expect(client.saveEntryCalls).toMatchObject([{kind: 'photo', description: 'receipt #tax', tags: ['#tax']}])
    expect(client.upsertFlowCalls).toHaveLength(0)
  })

  test('unsupported messages save as inbox entries and ask for description', async () => {
    const client = createFakeBotDataClient()
    const message: NormalizedEntryMessage = {
      ...PHOTO_MESSAGE,
      messageId: 503,
      kind: 'unsupported',
      telegram: {
        ...PHOTO_MESSAGE.telegram,
        type: 'message:location',
      },
    }

    const result = await handleMessage({identity: USER, message}, client)

    expect(result).toEqual({type: 'reply', text: 'Пока не умею разобрать этот тип. Опиши его несколькими словами, и я сохраню описание.'})
    expect(client.saveEntryCalls).toMatchObject([{kind: 'unsupported', description: null, descriptionSource: 'none', tags: []}])
    expect(client.upsertFlowCalls).toEqual([{userId: 'users:test', chatId: 420, kind: 'description', entryId: 'entries:test'}])
  })

  test('media messages do not replace an active flow', async () => {
    const client = createFakeBotDataClient({
      activeFlowResult: {
        status: 'active',
        flowId: 'flows:active',
        kind: 'description',
        entryId: 'entries:old',
      },
    })

    const result = await handleMessage({identity: USER, message: PHOTO_MESSAGE}, client)

    expect(result).toEqual({type: 'reply', text: 'Сначала закончим предыдущий материал: напиши описание или тег, потом пришли новый материал.'})
    expect(client.activeFlowCalls).toEqual([{userId: 'users:test', chatId: 420}])
    expect(client.saveEntryCalls).toHaveLength(0)
    expect(client.upsertFlowCalls).toHaveLength(0)
  })

  test('active description flow consumes the next text as searchable description', async () => {
    const client = createFakeBotDataClient({
      completeDescriptionFlowResult: {
        status: 'described',
        flowId: 'flows:test',
        entryId: 'entries:test',
        description: 'photo of monitor adapter',
      },
    })

    const result = await handleText({identity: USER, messageId: 105, text: 'photo of monitor adapter'}, client)

    expect(result).toEqual({type: 'reply', text: 'Сохранил описание. Теперь напиши тег в формате #example или оставь во входящих.'})
    expect(client.completeDescriptionFlowCalls).toEqual([{userId: 'users:test', chatId: 420, description: 'photo of monitor adapter'}])
    expect(client.saveEntryCalls).toHaveLength(0)
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

  test('/inbox_count counts only the registered user inbox', async () => {
    const client = createFakeBotDataClient({
      countInboxResult: {count: 3, isTruncated: false},
    })

    const result = await handleInboxCount({identity: USER}, client)

    expect(result).toEqual({type: 'reply', text: 'Во входящих: 3.'})
    expect(client.touchCommandCalls).toEqual([USER])
    expect(client.countInboxCalls).toEqual([{userId: 'users:test', limit: 100}])
  })

  test('/inbox opens the next inbox entry and offers tags plus skip', async () => {
    const client = createFakeBotDataClient({
      nextInboxResult: {
        status: 'found',
        entry: {
          id: 'entries:next',
          kind: 'text',
          text: 'купить переходник для монитора',
          description: null,
          url: null,
          createdAt: 100,
        },
      },
      listTagsResult: [
        {id: 'tags:work', name: 'work', slug: 'work'},
        {id: 'tags:home', name: 'home', slug: 'home'},
      ],
    })

    const result = await handleInbox({identity: USER}, client)

    expect(result).toEqual({
      type: 'reply',
      text: ['Входящие:', '', 'купить переходник для монитора', '', 'Выбери тег, напиши новый #tag или пропусти.'].join('\n'),
      buttons: [[{text: '#work', data: 'tag:pick:tags:work'}], [{text: '#home', data: 'tag:pick:tags:home'}], [{text: 'Пропустить', data: 'inbox:skip:entries:next'}]],
    })
    expect(client.nextInboxCalls).toEqual([{userId: 'users:test'}])
    expect(client.upsertFlowCalls).toEqual([{userId: 'users:test', chatId: 420, kind: 'tag', entryId: 'entries:next'}])
    expect(client.listTagsCalls).toEqual([{userId: 'users:test', limit: 8}])
  })

  test('/inbox replies with an empty state without creating a flow', async () => {
    const client = createFakeBotDataClient({
      nextInboxResult: {status: 'empty'},
    })

    const result = await handleInbox({identity: USER}, client)

    expect(result).toEqual({type: 'reply', text: 'Входящие пустые.'})
    expect(client.upsertFlowCalls).toHaveLength(0)
    expect(client.listTagsCalls).toHaveLength(0)
  })

  test('inbox skip callback cancels the active flow and keeps the entry in inbox', async () => {
    const client = createFakeBotDataClient({
      cancelTagFlowResult: {
        status: 'cancelled',
        flowId: 'flows:test',
        entryId: 'entries:next',
      },
    })

    const result = await handleCallback({identity: USER, data: inboxSkipCallback('entries:next')}, client)

    expect(result).toEqual({type: 'reply', text: 'Оставил во входящих.'})
    expect(client.cancelTagFlowCalls).toEqual([{userId: 'users:test', chatId: 420, entryId: 'entries:next'}])
  })
})
