import {describe, expect, test} from 'bun:test'

import {extractTagTokens, normalizeTagToken} from './tags.js'

describe('tags', () => {
  test('normalizes hashtag token without storing #', () => {
    expect(normalizeTagToken('#Project_Ideas')).toEqual({
      name: 'project_ideas',
      slug: 'project_ideas',
    })
  })

  test('supports cyrillic letters, digits, and underscore', () => {
    expect(normalizeTagToken('#Покупки_2026')).toEqual({
      name: 'покупки_2026',
      slug: 'покупки_2026',
    })
  })

  test('rejects tokens without hashtag or with spaces', () => {
    expect(normalizeTagToken('plain')).toBeNull()
    expect(normalizeTagToken('#bad tag')).toBeNull()
  })

  test('extracts inline hashtag tokens from any text position', () => {
    expect(extractTagTokens('#покупки купить переходник')).toEqual(['#покупки'])
    expect(extractTagTokens('купить #покупки переходник')).toEqual(['#покупки'])
    expect(extractTagTokens('купить переходник #покупки')).toEqual(['#покупки'])
  })

  test('deduplicates inline hashtag tokens by normalized slug', () => {
    expect(extractTagTokens('one #Ideas two #ideas three #покупки')).toEqual(['#Ideas', '#покупки'])
  })
})
