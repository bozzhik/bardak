import {makeFunctionReference} from 'convex/server'

export type ChatKind = 'bot' | 'group' | 'supergroup'

type NullableString = string | null

export type UserIdentityPayload = {
  userId: number
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

export type IncrementErrorCounterArgs = {
  userId: number
}

export type IncrementErrorCounterResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const incrementErrorCounterRef = makeFunctionReference<'mutation', IncrementErrorCounterArgs, IncrementErrorCounterResult>(
  'tables/users:incrementTelegramErrorCounter'
)
