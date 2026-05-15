import {describe, expect, test} from 'bun:test'

import {normalizeTextMessage} from '@/telegram/normalize'

describe('telegram normalize', () => {
  test('normalizes ordinary text messages', () => {
    expect(normalizeTextMessage('купить переходник')).toEqual({
      kind: 'text',
      text: 'купить переходник',
    })
  })

  test('normalizes text commands separately from content', () => {
    expect(normalizeTextMessage('/start payload')).toEqual({
      kind: 'command',
      command: '/start',
    })
  })
})
