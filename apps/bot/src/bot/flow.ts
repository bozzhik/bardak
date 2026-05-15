import type {RegisterOnStartArgs, RegisterOnStartResult, TouchOnTextResult, UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, START_MESSAGE} from '@/bot/messages'
import {normalizeTextMessage} from '@/telegram/normalize'

export type BotDataClient = {
  registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult>
  touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult>
}

export type ReplyResult = {
  type: 'reply'
  text: string
}

export type IgnoredCommandResult = {
  type: 'ignored_command'
  command: string
}

export type BotFlowResult = ReplyResult | IgnoredCommandResult

export type StartFlowInput = {
  identity: UserIdentityPayload | null
  startPayload: string | null
}

export type TextFlowInput = {
  identity: UserIdentityPayload | null
  text: string
}

export function readStartPayload(match: string | RegExpMatchArray | undefined): string | null {
  if (typeof match !== 'string') return null
  const payload = match.trim()
  return payload.length > 0 ? payload : null
}

export async function handleStart(input: StartFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  await client.registerOnStart({
    ...identity,
    startPayload: input.startPayload,
    registrationSource: 'telegram_start',
  })

  return {type: 'reply', text: START_MESSAGE}
}

export async function handleText(input: TextFlowInput, client: BotDataClient): Promise<BotFlowResult> {
  const message = normalizeTextMessage(input.text)
  if (message.kind === 'command') {
    return {type: 'ignored_command', command: message.command}
  }

  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnText(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  return {type: 'reply', text: message.text}
}
