import {extractTagTokens} from '@repo/shared'

import type {RegisterOnStartArgs, RegisterOnStartResult, SaveEntryArgs, SaveEntryResult, TouchOnTextResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, SAVED_TO_INBOX_MESSAGE, START_MESSAGE, savedWithTagsMessage} from '@/bot/messages'
import {normalizeTextMessage} from '@/telegram/normalize'

export type BotDataClient = {
  registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult>
  touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult>
  saveEntry(args: SaveEntryArgs): Promise<SaveEntryResult>
  upsertFlow(args: UpsertFlowArgs): Promise<UpsertFlowResult>
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
  messageId: number
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

  const tags = extractTagTokens(message.text)
  const entry = await client.saveEntry({
    userId: result.userId,
    sourceChatId: identity.chatId,
    sourceMessageId: input.messageId,
    kind: 'text',
    text: message.text,
    description: null,
    descriptionSource: 'text',
    url: null,
    tags,
  })

  if (entry.entryStatus === 'inbox') {
    await client.upsertFlow({
      userId: result.userId,
      chatId: identity.chatId,
      kind: 'tag',
      entryId: entry.entryId,
    })

    return {type: 'reply', text: SAVED_TO_INBOX_MESSAGE}
  }

  return {type: 'reply', text: savedWithTagsMessage(tags)}
}
