import {describe, expect, test} from 'bun:test'

import {normalizeTagToken} from './tags.js'

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
})
