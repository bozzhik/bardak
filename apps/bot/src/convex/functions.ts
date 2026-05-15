import {makeFunctionReference} from 'convex/server'

export type ChatKind = 'bot' | 'group' | 'supergroup'

type NullableString = string | null

export type UserIdentityPayload = {
  telegramId: number
  chatId: number
  chatKind: ChatKind
  isBotAccount: boolean
  username: NullableString
  firstName: NullableString
  lastName: NullableString
  languageCode: NullableString
  isPremium: boolean | null
  timezone: NullableString
  locale: NullableString
}

export type RegisterOnStartArgs = UserIdentityPayload & {
  startPayload: NullableString
  registrationSource: string
}

export type RegisterOnStartResult = {
  status: 'created' | 'updated'
  userId: string
}

export const registerOnStartRef = makeFunctionReference<'mutation', RegisterOnStartArgs, RegisterOnStartResult>('tables/users:registerFromTelegramStart')

export type TouchOnTextResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const touchOnTextRef = makeFunctionReference<'mutation', UserIdentityPayload, TouchOnTextResult>('tables/users:touchFromTelegramText')

export type SaveEntryArgs = {
  userId: string
  sourceChatId: number
  sourceMessageId: number
  kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
  text: string | null
  description: string | null
  descriptionSource?: 'none' | 'text' | 'caption' | 'user' | 'ai'
  url: string | null
  tags: string[]
}

export type SaveEntryResult = {
  status: 'created' | 'duplicate'
  entryId: string
  entryStatus: 'inbox' | 'saved' | 'archived'
  tagIds: string[]
}

export const saveEntryRef = makeFunctionReference<'mutation', SaveEntryArgs, SaveEntryResult>('tables/entries:save')

export type UpsertFlowArgs = {
  userId: string
  chatId: number
  kind: 'tag'
  entryId: string
}

export type UpsertFlowResult = {
  status: 'created' | 'replaced'
  flowId: string
}

export const upsertFlowRef = makeFunctionReference<'mutation', UpsertFlowArgs, UpsertFlowResult>('tables/flows:upsertActive')

export type CompleteTagFlowArgs = {
  userId: string
  chatId: number
  tags: string[]
}

export type CompleteTagFlowResult = {status: 'no_active'} | {status: 'invalid_tag'; flowId: string; entryId: string} | {status: 'tagged'; flowId: string; entryId: string; tagIds: string[]}

export const completeTagFlowRef = makeFunctionReference<'mutation', CompleteTagFlowArgs, CompleteTagFlowResult>('tables/flows:completeTag')

export type IncrementErrorCounterArgs = {
  telegramId: number
}

export type IncrementErrorCounterResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const incrementErrorCounterRef = makeFunctionReference<'mutation', IncrementErrorCounterArgs, IncrementErrorCounterResult>('tables/users:incrementTelegramErrorCounter')

export type BotEventContext = {
  updateId: number | null
  messageId: number | null
  textLength: number | null
  errorName: string | null
  reason: string | null
}

export type RecordBotEventArgs = {
  userId?: string | null
  telegramId?: number | null
  chatId?: number | null
  chatKind?: ChatKind | null
  kind: 'command' | 'message' | 'flow' | 'entry' | 'error' | 'system'
  action: string
  status: 'ok' | 'ignored' | 'rejected' | 'error'
  command?: string | null
  messageKind?: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported' | null
  entryId?: string | null
  flowId?: string | null
  context?: BotEventContext
}

export type RecordBotEventResult = {
  eventId: string
}

export const recordBotEventRef = makeFunctionReference<'mutation', RecordBotEventArgs, RecordBotEventResult>('tables/botEvents:record')
