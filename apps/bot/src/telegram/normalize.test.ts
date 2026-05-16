import {describe, expect, test} from 'bun:test'

import {normalizeTelegramMessage, normalizeTextMessage, type TelegramMessageLike} from '@/telegram/normalize'

describe('telegram normalize', () => {
  test('normalizes ordinary text messages', () => {
    expect(normalizeTextMessage('купить переходник')).toEqual({
      kind: 'text',
      text: 'купить переходник',
    })
  })

  test('normalizes text commands separately from capturable text', () => {
    expect(normalizeTextMessage('/start payload')).toEqual({
      kind: 'command',
      command: '/start',
    })
  })

  test('normalizes link text as a link entry', () => {
    expect(normalizeTelegramMessage({message_id: 11, text: 'read https://example.com/page #read'})).toMatchObject({
      kind: 'entry',
      entry: {
        messageId: 11,
        kind: 'link',
        text: 'read https://example.com/page #read',
        description: null,
        descriptionSource: 'text',
        url: 'https://example.com/page',
        telegram: {
          type: 'message:text',
        },
      },
    })
  })

  test('normalizes photo caption and largest photo metadata', () => {
    const message: TelegramMessageLike = {
      message_id: 12,
      caption: 'receipt #tax',
      photo: [
        {file_id: 'small', file_unique_id: 'small-unique', file_size: 100, width: 90, height: 90},
        {file_id: 'large', file_unique_id: 'large-unique', file_size: 500, width: 1280, height: 720},
      ],
    }

    expect(normalizeTelegramMessage(message)).toMatchObject({
      kind: 'entry',
      entry: {
        messageId: 12,
        kind: 'photo',
        text: null,
        description: 'receipt #tax',
        descriptionSource: 'caption',
        telegram: {
          type: 'message:photo',
          file: {
            fileId: 'large',
            fileUniqueId: 'large-unique',
            fileSize: 500,
            width: 1280,
            height: 720,
          },
        },
      },
    })
  })

  test('normalizes forwarded reply metadata as context', () => {
    const message: TelegramMessageLike = {
      message_id: 13,
      text: 'forwarded note',
      forward_origin: {
        type: 'hidden_user',
        sender_user_name: 'Private Name',
        date: 1790000000,
      },
      reply_to_message: {
        message_id: 12,
      },
    }

    expect(normalizeTelegramMessage(message)).toMatchObject({
      kind: 'entry',
      entry: {
        telegram: {
          context: {
            forwardOrigin: 'hidden_user:Private Name',
            forwardDate: 1790000000000,
            replyToMessageId: 12,
          },
        },
      },
    })
  })

  test('normalizes voice, document, sticker, and unsupported messages', () => {
    expect(
      normalizeTelegramMessage({
        message_id: 14,
        voice: {file_id: 'voice-id', file_unique_id: 'voice-unique', file_size: 1000, duration: 8},
      }),
    ).toMatchObject({
      kind: 'entry',
      entry: {
        kind: 'voice',
        description: null,
        descriptionSource: 'none',
        telegram: {type: 'message:voice', file: {fileId: 'voice-id', duration: 8}},
      },
    })

    expect(
      normalizeTelegramMessage({
        message_id: 15,
        caption: 'contract',
        document: {file_id: 'doc-id', file_unique_id: 'doc-unique', file_name: 'contract.pdf', mime_type: 'application/pdf', file_size: 2000},
      }),
    ).toMatchObject({
      kind: 'entry',
      entry: {
        kind: 'document',
        description: 'contract',
        descriptionSource: 'caption',
        telegram: {type: 'message:document', file: {fileId: 'doc-id', fileName: 'contract.pdf', mimeType: 'application/pdf'}},
      },
    })

    expect(
      normalizeTelegramMessage({
        message_id: 16,
        sticker: {file_id: 'sticker-id', file_unique_id: 'sticker-unique', emoji: 'ok', set_name: 'pack', is_animated: false, is_video: true},
      }),
    ).toMatchObject({
      kind: 'entry',
      entry: {
        kind: 'sticker',
        telegram: {type: 'message:sticker', file: {fileId: 'sticker-id', emoji: 'ok', setName: 'pack', isVideo: true}},
      },
    })

    expect(normalizeTelegramMessage({message_id: 17, location: {latitude: 1, longitude: 2}})).toMatchObject({
      kind: 'entry',
      entry: {
        kind: 'unsupported',
        descriptionSource: 'none',
        telegram: {type: 'message:location'},
      },
    })
  })
})
