import {ConvexHttpClient} from 'convex/browser'
import type {FunctionReference} from 'convex/server'

import {NEXT_PUBLIC_CONVEX_URL} from './config.js'

const convex = new ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL)
const upsertTelegramUserRef = 'bot:upsertTelegramUser' as unknown as FunctionReference<'mutation'>
const saveIncomingContentRef = 'bot:saveIncomingContent' as unknown as FunctionReference<'mutation'>

export type IncomingContentKind = 'text' | 'link' | 'photo' | 'document' | 'voice' | 'forwarded' | 'unknown'

export type SaveIncomingContentInput = {
  telegramUserId: number
  username?: string
  firstName?: string
  lastName?: string
  telegramChatId: number
  telegramMessageId: number
  contentType: IncomingContentKind
  text?: string
  payloadJson: string
}

export const upsertTelegramUser = async (input: {
  telegramUserId: number
  username?: string
  firstName?: string
  lastName?: string
}) => {
  return await convex.mutation(upsertTelegramUserRef, input)
}

export const saveIncomingContent = async (input: SaveIncomingContentInput) => {
  return await convex.mutation(saveIncomingContentRef, input)
}
