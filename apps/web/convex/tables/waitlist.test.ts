import {describe, expect, test} from 'bun:test'
import {convexTest} from 'convex-test'
import {makeFunctionReference} from 'convex/server'

import type {Id} from '../_generated/dataModel'
import schema from '../schema'

type SubmitWaitlistArgs = {
  username: string
}

type SubmitWaitlistResult = {status: 'created'; id: Id<'waitlist'>} | {status: 'duplicate'} | {status: 'invalid'; message: string}

type GetWaitlistByIdArgs = {
  id: Id<'waitlist'>
}

type GetWaitlistByIdResult = {
  _id: Id<'waitlist'>
  _creationTime: number
  username: string
  telegramLink: string
  status?: 'active' | 'converted' | 'archived'
  createdAt?: number
  updatedAt?: number
} | null

const submitWaitlistRef = makeFunctionReference<'mutation', SubmitWaitlistArgs, SubmitWaitlistResult>('tables/waitlist:submit')
const getWaitlistByIdRef = makeFunctionReference<'query', GetWaitlistByIdArgs, GetWaitlistByIdResult>('tables/waitlist:getById')

const modules = {
  '../_generated/api.ts': () => import('../_generated/api'),
  '../_generated/server.ts': () => import('../_generated/server'),
  '../tables/waitlist.ts': () => import('./waitlist'),
}

describe('waitlist data model', () => {
  test('keeps legacy rows valid when metadata fields are missing', async () => {
    const t = convexTest(schema, modules)

    const id = await t.run((ctx) =>
      ctx.db.insert('waitlist', {
        username: 'legacy',
        telegramLink: 'https://t.me/legacy',
      }),
    )

    const row = await t.query(getWaitlistByIdRef, {id})

    expect(row).toMatchObject({
      _id: id,
      username: 'legacy',
      telegramLink: 'https://t.me/legacy',
    })
    expect(row?.status).toBeUndefined()
    expect(row?.createdAt).toBeUndefined()
    expect(row?.updatedAt).toBeUndefined()
  })

  test('writes metadata for new waitlist rows', async () => {
    const t = convexTest(schema, modules)

    const result = await t.mutation(submitWaitlistRef, {username: '@new_user'})
    if (result.status !== 'created') throw new Error('Expected created waitlist row')

    const row = await t.query(getWaitlistByIdRef, {id: result.id})

    expect(row).toMatchObject({
      username: 'new_user',
      telegramLink: 'https://t.me/new_user',
      status: 'active',
    })
    expect(row?.createdAt).toBeNumber()
    expect(row?.updatedAt).toBeNumber()
  })
})
