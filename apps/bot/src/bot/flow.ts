import {extractTagTokens, normalizeTagToken} from '@repo/shared'

import type {CancelTagFlowArgs, CancelTagFlowResult, CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult, CompleteTagFlowArgs, CompleteTagFlowResult, CountInboxArgs, CountInboxResult, EnsureTagArgs, EnsureTagResult, FindTagArgs, FindTagResult, ListTagsArgs, ListTagsResult, NextInboxArgs, NextInboxResult, RegisterOnStartArgs, RegisterOnStartResult, RemoveTagArgs, RemoveTagResult, RenameTagArgs, RenameTagResult, SaveEntryArgs, SaveEntryResult, TouchOnCommandResult, TouchOnTextResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

import {BOTS_NOT_SUPPORTED_MESSAGE, INBOX_EMPTY_MESSAGE, INBOX_SKIPPED_MESSAGE, INVALID_CONTEXT_MESSAGE, NO_ACTIVE_FLOW_MESSAGE, NOT_REGISTERED_MESSAGE, SAVED_TO_INBOX_MESSAGE, START_MESSAGE, TAGS_EMPTY_MESSAGE, TAG_DELETE_CANCELLED_MESSAGE, TAG_DELETE_USAGE_MESSAGE, TAG_FORMAT_MESSAGE, TAG_NEW_USAGE_MESSAGE, TAG_RENAME_USAGE_MESSAGE, UNKNOWN_ACTION_MESSAGE, inboxCountMessage, inboxItemMessage, savedWithTagsMessage, tagCreatedMessage, tagDeleteConfirmMessage, tagDeletedMessage, tagExistsMessage, tagNotFoundMessage, tagRenamedMessage, tagsListMessage} from '@/bot/messages'
import {normalizeTextMessage} from '@/telegram/normalize'

export type BotDataClient = {
  registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult>
  touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult>
  touchOnCommand(args: UserIdentityPayload): Promise<TouchOnCommandResult>
  listTags(args: ListTagsArgs): Promise<ListTagsResult>
  countInbox(args: CountInboxArgs): Promise<CountInboxResult>
  getNextInbox(args: NextInboxArgs): Promise<NextInboxResult>
  ensureTag(args: EnsureTagArgs): Promise<EnsureTagResult>
  renameTag(args: RenameTagArgs): Promise<RenameTagResult>
  findTag(args: FindTagArgs): Promise<FindTagResult>
  removeTag(args: RemoveTagArgs): Promise<RemoveTagResult>
  completeTagFlow(args: CompleteTagFlowArgs): Promise<CompleteTagFlowResult>
  completeTagFlowById(args: CompleteTagFlowByIdArgs): Promise<CompleteTagFlowByIdResult>
  cancelTagFlow(args: CancelTagFlowArgs): Promise<CancelTagFlowResult>
  saveEntry(args: SaveEntryArgs): Promise<SaveEntryResult>
  upsertFlow(args: UpsertFlowArgs): Promise<UpsertFlowResult>
}

export type ReplyButton = {
  text: string
  data: string
}

export type ReplyResult = {
  type: 'reply'
  text: string
  buttons?: ReplyButton[][]
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

export type TagsFlowInput = {
  identity: UserIdentityPayload | null
}

export type InboxFlowInput = {
  identity: UserIdentityPayload | null
}

export type TagNewFlowInput = {
  identity: UserIdentityPayload | null
  tag: string | null
}

export type TagRenameFlowInput = {
  identity: UserIdentityPayload | null
  payload: string | null
}

export type TagDeleteFlowInput = {
  identity: UserIdentityPayload | null
  tag: string | null
}

export type CallbackFlowInput = {
  identity: UserIdentityPayload | null
  data: string
}

export function readStartPayload(match: string | RegExpMatchArray | undefined): string | null {
  if (typeof match !== 'string') return null
  const payload = match.trim()
  return payload.length > 0 ? payload : null
}

export function tagPickCallback(tagId: string): string {
  return `tag:pick:${tagId}`
}

export function tagDeleteConfirmCallback(tagId: string): string {
  return `tag:delete:confirm:${tagId}`
}

export function tagDeleteCancelCallback(tagId: string): string {
  return `tag:delete:cancel:${tagId}`
}

export function inboxSkipCallback(entryId: string): string {
  return `inbox:skip:${entryId}`
}

function parseTwoTags(payload: string | null): {fromTag: string; toTag: string} | null {
  if (payload === null) return null
  const [fromTag, toTag, extra] = payload.trim().split(/\s+/)
  if (fromTag === undefined || toTag === undefined || extra !== undefined) return null
  if (normalizeTagToken(fromTag) === null || normalizeTagToken(toTag) === null) return null
  return {fromTag, toTag}
}

function tagButtons(tags: ListTagsResult): ReplyButton[][] {
  return tags.map((tag) => [{text: `#${tag.name}`, data: tagPickCallback(tag.id)}])
}

function parseCallbackData(data: string): {kind: 'pick'; tagId: string} | {kind: 'delete_confirm'; tagId: string} | {kind: 'delete_cancel'; tagId: string} | {kind: 'inbox_skip'; entryId: string} | null {
  if (data.startsWith('tag:pick:')) return {kind: 'pick', tagId: data.slice('tag:pick:'.length)}
  if (data.startsWith('tag:delete:confirm:')) return {kind: 'delete_confirm', tagId: data.slice('tag:delete:confirm:'.length)}
  if (data.startsWith('tag:delete:cancel:')) return {kind: 'delete_cancel', tagId: data.slice('tag:delete:cancel:'.length)}
  if (data.startsWith('inbox:skip:')) return {kind: 'inbox_skip', entryId: data.slice('inbox:skip:'.length)}
  return null
}

function buildInboxPreview(entry: Extract<NextInboxResult, {status: 'found'}>['entry']): string {
  const source = entry.text ?? entry.description ?? entry.url ?? `[${entry.kind}]`
  const collapsed = source.trim().replace(/\s+/g, ' ')
  if (collapsed.length <= 160) return collapsed
  return `${collapsed.slice(0, 157)}...`
}

function inboxButtons(tags: ListTagsResult, entryId: string): ReplyButton[][] {
  return [...tagButtons(tags), [{text: 'Пропустить', data: inboxSkipCallback(entryId)}]]
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

export async function handleTags(input: TagsFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const tags = await client.listTags({
    userId: result.userId,
    limit: 50,
  })

  return {type: 'reply', text: tags.length > 0 ? tagsListMessage(tags) : TAGS_EMPTY_MESSAGE}
}

export async function handleInboxCount(input: InboxFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const identity = input.identity
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const count = await client.countInbox({
    userId: result.userId,
    limit: 100,
  })

  return {type: 'reply', text: inboxCountMessage(count.count, count.isTruncated)}
}

export async function handleInbox(input: InboxFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const identity = input.identity
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const next = await client.getNextInbox({userId: result.userId})
  if (next.status === 'empty') {
    return {type: 'reply', text: INBOX_EMPTY_MESSAGE}
  }

  await client.upsertFlow({
    userId: result.userId,
    chatId: identity.chatId,
    kind: 'tag',
    entryId: next.entry.id,
  })

  const existingTags = await client.listTags({
    userId: result.userId,
    limit: 8,
  })

  return {
    type: 'reply',
    text: inboxItemMessage(buildInboxPreview(next.entry)),
    buttons: inboxButtons(existingTags, next.entry.id),
  }
}

export async function handleTagNew(input: TagNewFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const rawTag = input.tag
  if (rawTag === null) {
    return {type: 'reply', text: TAG_NEW_USAGE_MESSAGE}
  }

  const tag = normalizeTagToken(rawTag)
  if (tag === null) {
    return {type: 'reply', text: TAG_NEW_USAGE_MESSAGE}
  }

  const ensured = await client.ensureTag({
    userId: result.userId,
    tag: rawTag,
  })

  if (ensured.status === 'invalid') {
    return {type: 'reply', text: TAG_NEW_USAGE_MESSAGE}
  }

  return {type: 'reply', text: ensured.status === 'created' ? tagCreatedMessage(tag.name) : tagExistsMessage(tag.name)}
}

export async function handleTagRename(input: TagRenameFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const parsed = parseTwoTags(input.payload)
  if (parsed === null) {
    return {type: 'reply', text: TAG_RENAME_USAGE_MESSAGE}
  }

  const renamed = await client.renameTag({
    userId: result.userId,
    fromTag: parsed.fromTag,
    toTag: parsed.toTag,
  })
  const fromTag = normalizeTagToken(parsed.fromTag)
  const toTag = normalizeTagToken(parsed.toTag)
  if (fromTag === null || toTag === null || renamed.status === 'invalid') {
    return {type: 'reply', text: TAG_RENAME_USAGE_MESSAGE}
  }

  if (renamed.status === 'source_missing') {
    return {type: 'reply', text: tagNotFoundMessage(fromTag.name)}
  }

  if (renamed.status === 'target_exists') {
    return {type: 'reply', text: tagExistsMessage(toTag.name)}
  }

  return {type: 'reply', text: tagRenamedMessage(fromTag.name, toTag.name)}
}

export async function handleTagDelete(input: TagDeleteFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const rawTag = input.tag
  const tag = rawTag === null ? null : normalizeTagToken(rawTag)
  if (rawTag === null || tag === null) {
    return {type: 'reply', text: TAG_DELETE_USAGE_MESSAGE}
  }

  const found = await client.findTag({
    userId: result.userId,
    tag: rawTag,
  })

  if (found.status === 'invalid') {
    return {type: 'reply', text: TAG_DELETE_USAGE_MESSAGE}
  }

  if (found.status === 'missing') {
    return {type: 'reply', text: tagNotFoundMessage(tag.name)}
  }

  return {
    type: 'reply',
    text: tagDeleteConfirmMessage(found.tag.name),
    buttons: [
      [
        {text: 'Удалить', data: tagDeleteConfirmCallback(found.tag.id)},
        {text: 'Отмена', data: tagDeleteCancelCallback(found.tag.id)},
      ],
    ],
  }
}

export async function handleCallback(input: CallbackFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  const callback = parseCallbackData(input.data)
  if (callback === null) {
    return {type: 'reply', text: UNKNOWN_ACTION_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  if (callback.kind === 'delete_cancel') {
    return {type: 'reply', text: TAG_DELETE_CANCELLED_MESSAGE}
  }

  if (callback.kind === 'inbox_skip') {
    await client.cancelTagFlow({
      userId: result.userId,
      chatId: identity.chatId,
      entryId: callback.entryId,
    })

    return {type: 'reply', text: INBOX_SKIPPED_MESSAGE}
  }

  if (callback.kind === 'delete_confirm') {
    const removed = await client.removeTag({
      userId: result.userId,
      tagId: callback.tagId,
    })

    return {type: 'reply', text: removed.status === 'deleted' ? tagDeletedMessage(removed.tagName) : UNKNOWN_ACTION_MESSAGE}
  }

  const completed = await client.completeTagFlowById({
    userId: result.userId,
    chatId: identity.chatId,
    tagId: callback.tagId,
  })

  if (completed.status === 'no_active') {
    return {type: 'reply', text: NO_ACTIVE_FLOW_MESSAGE}
  }

  if (completed.status === 'missing_tag') {
    return {type: 'reply', text: UNKNOWN_ACTION_MESSAGE}
  }

  return {type: 'reply', text: savedWithTagsMessage([`#${completed.tagName}`])}
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
  const flow = await client.completeTagFlow({
    userId: result.userId,
    chatId: identity.chatId,
    tags,
  })

  if (flow.status === 'tagged') {
    return {type: 'reply', text: savedWithTagsMessage(tags)}
  }

  if (flow.status === 'invalid_tag') {
    return {type: 'reply', text: TAG_FORMAT_MESSAGE}
  }

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

    const existingTags = await client.listTags({
      userId: result.userId,
      limit: 8,
    })

    return {
      type: 'reply',
      text: SAVED_TO_INBOX_MESSAGE,
      ...(existingTags.length > 0 ? {buttons: tagButtons(existingTags)} : {}),
    }
  }

  return {type: 'reply', text: savedWithTagsMessage(tags)}
}
