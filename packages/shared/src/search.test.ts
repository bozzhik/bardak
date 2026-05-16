import {describe, expect, test} from 'bun:test'

import {parseSearchInput} from './search.js'

describe('search input', () => {
  test('parses text, hashtag filters, and kind filter from one query', () => {
    expect(parseSearchInput('  договор #работа type:document  ')).toEqual({
      status: 'ok',
      criteria: {
        text: 'договор',
        tags: ['#работа'],
        kind: 'document',
      },
    })
  })

  test('deduplicates tags and accepts kind alias', () => {
    expect(parseSearchInput('#Work #work kind:photo')).toEqual({
      status: 'ok',
      criteria: {
        text: null,
        tags: ['#work'],
        kind: 'photo',
      },
    })
  })

  test('rejects empty or unsupported searches', () => {
    expect(parseSearchInput('   ')).toEqual({status: 'empty'})
    expect(parseSearchInput('type:unknown')).toEqual({status: 'invalid_kind', kind: 'unknown'})
  })
})
