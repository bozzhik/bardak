import {extractTagTokens, normalizeTagToken, parseSearchInput} from '@repo/shared'

import type {ArchiveEntryBySourceMessageArgs, ArchiveEntryBySourceMessageResult, CancelTagFlowArgs, CancelTagFlowResult, CompleteDescriptionFlowArgs, CompleteDescriptionFlowResult, CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult, CompleteTagFlowArgs, CompleteTagFlowResult, CountInboxArgs, CountInboxResult, EnsureTagArgs, EnsureTagResult, FindTagArgs, FindTagResult, GetActiveFlowArgs, GetActiveFlowResult, ListTagsArgs, ListTagsResult, NextInboxArgs, NextInboxResult, RegisterOnStartArgs, RegisterOnStartResult, RemoveTagArgs, RemoveTagResult, RenameTagArgs, RenameTagResult, SaveEntryArgs, SaveEntryResult, SearchEntriesArgs, SearchEntriesResult, TouchOnCommandResult, TouchOnTextResult, UpdateEntryFromEditArgs, UpdateEntryFromEditResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

import {ACTIVE_FLOW_MESSAGE, BOTS_NOT_SUPPORTED_MESSAGE, DELETE_REPLY_USAGE_MESSAGE, DESCRIPTION_SAVED_MESSAGE, EDITED_ENTRY_MESSAGE, EDITED_ENTRY_NOT_FOUND_MESSAGE, ENTRY_ARCHIVED_MESSAGE, ENTRY_NOT_FOUND_MESSAGE, INBOX_EMPTY_MESSAGE, INBOX_SKIPPED_MESSAGE, INVALID_CONTEXT_MESSAGE, NEED_DESCRIPTION_MESSAGE, NO_ACTIVE_FLOW_MESSAGE, NOT_REGISTERED_MESSAGE, PRIVATE_ONLY_MESSAGE, SAVED_TO_INBOX_MESSAGE, SEARCH_EMPTY_MESSAGE, SEARCH_INVALID_KIND_MESSAGE, SEARCH_USAGE_MESSAGE, START_MESSAGE, TAGS_EMPTY_MESSAGE, TAG_DELETE_CANCELLED_MESSAGE, TAG_DELETE_USAGE_MESSAGE, TAG_FORMAT_MESSAGE, TAG_NEW_USAGE_MESSAGE, TAG_RENAME_USAGE_MESSAGE, UNKNOWN_ACTION_MESSAGE, UNSUPPORTED_DESCRIPTION_MESSAGE, inboxCountMessage, inboxItemMessage, savedWithTagsMessage, searchResultsMessage, tagCreatedMessage, tagDeleteConfirmMessage, tagDeletedMessage, tagExistsMessage, tagNotFoundMessage, tagRenamedMessage, tagsListMessage} from '@/bot/messages'
import {normalizeTelegramMessage, type NormalizedEntryMessage} from '@/telegram/normalize'

export type BotDataClient = {
  registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult>
  touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult>
  touchOnCommand(args: UserIdentityPayload): Promise<TouchOnCommandResult>
  listTags(args: ListTagsArgs): Promise<ListTagsResult>
  countInbox(args: CountInboxArgs): Promise<CountInboxResult>
  getNextInbox(args: NextInboxArgs): Promise<NextInboxResult>
  searchEntries(args: SearchEntriesArgs): Promise<SearchEntriesResult>
  ensureTag(args: EnsureTagArgs): Promise<EnsureTagResult>
  renameTag(args: RenameTagArgs): Promise<RenameTagResult>
  findTag(args: FindTagArgs): Promise<FindTagResult>
  removeTag(args: RemoveTagArgs): Promise<RemoveTagResult>
  completeTagFlow(args: CompleteTagFlowArgs): Promise<CompleteTagFlowResult>
  completeTagFlowById(args: CompleteTagFlowByIdArgs): Promise<CompleteTagFlowByIdResult>
  completeDescriptionFlow(args: CompleteDescriptionFlowArgs): Promise<CompleteDescriptionFlowResult>
  cancelTagFlow(args: CancelTagFlowArgs): Promise<CancelTagFlowResult>
  saveEntry(args: SaveEntryArgs): Promise<SaveEntryResult>
  updateEntryFromEdit(args: UpdateEntryFromEditArgs): Promise<UpdateEntryFromEditResult>
  archiveEntryBySourceMessage(args: ArchiveEntryBySourceMessageArgs): Promise<ArchiveEntryBySourceMessageResult>
  upsertFlow(args: UpsertFlowArgs): Promise<UpsertFlowResult>
  getActiveFlow(args: GetActiveFlowArgs): Promise<GetActiveFlowResult>
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

export type MessageFlowInput = {
  identity: UserIdentityPayload | null
  message: NormalizedEntryMessage
}

export type DeleteFlowInput = {
  identity: UserIdentityPayload | null
  replyToMessageId: number | null
}

export type TagsFlowInput = {
  identity: UserIdentityPayload | null
}

export type InboxFlowInput = {
  identity: UserIdentityPayload | null
}

export type SearchFlowInput = {
  identity: UserIdentityPayload | null
  query: string | null
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

function entrySearchText(message: NormalizedEntryMessage): string {
  return message.text ?? message.description ?? ''
}

function needsDescription(message: NormalizedEntryMessage): boolean {
  return message.description === null && message.descriptionSource === 'none' && message.text === null
}

function hasTelegramMetadata(message: NormalizedEntryMessage): boolean {
  const {telegram} = message
  return (message.kind !== 'text' && message.kind !== 'link') || telegram.context.forwardOrigin !== null || telegram.context.forwardDate !== null || telegram.context.replyToMessageId !== null || telegram.file.fileId !== null
}

function isPrivateChat(identity: UserIdentityPayload): boolean {
  return identity.chatKind === 'bot'
}

export async function handleStart(input: StartFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

export async function handleSearch(input: SearchFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
  }

  const parsed = parseSearchInput(input.query ?? '')
  if (parsed.status === 'empty') {
    return {type: 'reply', text: SEARCH_USAGE_MESSAGE}
  }

  if (parsed.status === 'invalid_kind') {
    return {type: 'reply', text: SEARCH_INVALID_KIND_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const found = await client.searchEntries({
    userId: result.userId,
    text: parsed.criteria.text,
    tags: parsed.criteria.tags,
    kind: parsed.criteria.kind,
    limit: 5,
  })

  if (found.items.length === 0) {
    return {type: 'reply', text: SEARCH_EMPTY_MESSAGE}
  }

  return {type: 'reply', text: searchResultsMessage(found.items, found.isTruncated)}
}

export async function handleTagNew(input: TagNewFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
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
  const normalized = normalizeTelegramMessage({message_id: input.messageId, text: input.text})
  if (normalized.kind === 'command') {
    return {type: 'ignored_command', command: normalized.command}
  }

  return await handleTextMessage({identity: input.identity, message: normalized.entry}, client)
}

export async function handleTextMessage(input: MessageFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
  }

  const result = await client.touchOnText(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const described = await client.completeDescriptionFlow({
    userId: result.userId,
    chatId: identity.chatId,
    description: input.message.text ?? input.message.description ?? '',
  })

  if (described.status === 'described') {
    const existingTags = await client.listTags({
      userId: result.userId,
      limit: 8,
    })

    return {
      type: 'reply',
      text: DESCRIPTION_SAVED_MESSAGE,
      ...(existingTags.length > 0 ? {buttons: tagButtons(existingTags)} : {}),
    }
  }

  if (described.status === 'invalid_description') {
    return {type: 'reply', text: NEED_DESCRIPTION_MESSAGE}
  }

  return await saveNormalizedEntry(input, client, result.userId)
}

export async function handleMessage(input: MessageFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
  }

  const result = await client.touchOnText(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const active = await client.getActiveFlow({
    userId: result.userId,
    chatId: identity.chatId,
  })
  if (active.status === 'active') {
    return {type: 'reply', text: ACTIVE_FLOW_MESSAGE}
  }

  return await saveNormalizedEntry(input, client, result.userId)
}

export async function handleEditedMessage(input: MessageFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity, message} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
  }

  const result = await client.touchOnText(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  const tags = extractTagTokens(entrySearchText(message))
  const updated = await client.updateEntryFromEdit({
    userId: result.userId,
    sourceChatId: identity.chatId,
    sourceMessageId: message.messageId,
    kind: message.kind,
    text: message.text,
    description: message.description,
    descriptionSource: message.descriptionSource,
    url: message.url,
    tags,
    ...(hasTelegramMetadata(message) ? {telegram: message.telegram} : {}),
  })

  if (updated.status === 'no_existing') {
    return {type: 'reply', text: EDITED_ENTRY_NOT_FOUND_MESSAGE}
  }

  if (updated.entryStatus === 'inbox') {
    await client.upsertFlow({
      userId: result.userId,
      chatId: identity.chatId,
      kind: needsDescription(message) ? 'description' : 'tag',
      entryId: updated.entryId,
    })
  }

  return {type: 'reply', text: EDITED_ENTRY_MESSAGE}
}

export async function handleDelete(input: DeleteFlowInput, client: BotDataClient): Promise<ReplyResult> {
  const {identity} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  if (identity.isBotAccount) {
    return {type: 'reply', text: BOTS_NOT_SUPPORTED_MESSAGE}
  }

  if (!isPrivateChat(identity)) {
    return {type: 'reply', text: PRIVATE_ONLY_MESSAGE}
  }

  const result = await client.touchOnCommand(identity)
  if (result.status === 'not_registered') {
    return {type: 'reply', text: NOT_REGISTERED_MESSAGE}
  }

  if (input.replyToMessageId === null) {
    return {type: 'reply', text: DELETE_REPLY_USAGE_MESSAGE}
  }

  const archived = await client.archiveEntryBySourceMessage({
    userId: result.userId,
    sourceChatId: identity.chatId,
    sourceMessageId: input.replyToMessageId,
  })

  return {type: 'reply', text: archived.status === 'archived' ? ENTRY_ARCHIVED_MESSAGE : ENTRY_NOT_FOUND_MESSAGE}
}

async function saveNormalizedEntry(input: MessageFlowInput, client: BotDataClient, userId: string): Promise<ReplyResult> {
  const {identity, message} = input
  if (identity === null) {
    return {type: 'reply', text: INVALID_CONTEXT_MESSAGE}
  }

  const searchable = entrySearchText(message)
  const tags = extractTagTokens(searchable)
  const flow = await client.completeTagFlow({
    userId,
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
    userId,
    sourceChatId: identity.chatId,
    sourceMessageId: message.messageId,
    kind: message.kind,
    text: message.text,
    description: message.description,
    descriptionSource: message.descriptionSource,
    url: message.url,
    tags,
    ...(hasTelegramMetadata(message) ? {telegram: message.telegram} : {}),
  })

  if (entry.entryStatus === 'inbox') {
    await client.upsertFlow({
      userId,
      chatId: identity.chatId,
      kind: needsDescription(message) ? 'description' : 'tag',
      entryId: entry.entryId,
    })

    if (needsDescription(message)) {
      return {type: 'reply', text: message.kind === 'unsupported' ? UNSUPPORTED_DESCRIPTION_MESSAGE : NEED_DESCRIPTION_MESSAGE}
    }

    const existingTags = await client.listTags({
      userId,
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
