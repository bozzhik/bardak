import {ConvexHttpClient} from 'convex/browser'

import {env} from '@/config/env'
import {cancelTagFlowRef, type CancelTagFlowArgs, type CancelTagFlowResult, completeDescriptionFlowRef, type CompleteDescriptionFlowArgs, type CompleteDescriptionFlowResult, completeTagFlowByIdRef, type CompleteTagFlowByIdArgs, type CompleteTagFlowByIdResult, completeTagFlowRef, type CompleteTagFlowArgs, type CompleteTagFlowResult, countInboxRef, type CountInboxArgs, type CountInboxResult, ensureTagRef, type EnsureTagArgs, type EnsureTagResult, findTagRef, type FindTagArgs, type FindTagResult, getActiveFlowRef, type GetActiveFlowArgs, type GetActiveFlowResult, getNextInboxRef, incrementErrorCounterRef, type IncrementErrorCounterResult, listTagsRef, type ListTagsArgs, type ListTagsResult, type NextInboxArgs, type NextInboxResult, recordBotEventRef, type RecordBotEventArgs, type RecordBotEventResult, registerOnStartRef, type RegisterOnStartArgs, type RegisterOnStartResult, removeTagRef, type RemoveTagArgs, type RemoveTagResult, renameTagRef, type RenameTagArgs, type RenameTagResult, saveEntryRef, type SaveEntryArgs, type SaveEntryResult, touchOnCommandRef, type TouchOnCommandResult, touchOnTextRef, type TouchOnTextResult, type UpsertFlowArgs, type UpsertFlowResult, type UserIdentityPayload, upsertFlowRef} from '@/convex/functions'

const client = new ConvexHttpClient(env.convexUrl)

export async function registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult> {
  return await client.mutation(registerOnStartRef, args)
}

export async function touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult> {
  return await client.mutation(touchOnTextRef, args)
}

export async function touchOnCommand(args: UserIdentityPayload): Promise<TouchOnCommandResult> {
  return await client.mutation(touchOnCommandRef, args)
}

export async function listTags(args: ListTagsArgs): Promise<ListTagsResult> {
  const tags = await client.query(listTagsRef, args)
  return tags.map((tag) => ({
    id: tag._id,
    name: tag.name,
    slug: tag.slug,
  }))
}

export async function countInbox(args: CountInboxArgs): Promise<CountInboxResult> {
  return await client.query(countInboxRef, args)
}

export async function getNextInbox(args: NextInboxArgs): Promise<NextInboxResult> {
  return await client.query(getNextInboxRef, args)
}

export async function ensureTag(args: EnsureTagArgs): Promise<EnsureTagResult> {
  return await client.mutation(ensureTagRef, args)
}

export async function renameTag(args: RenameTagArgs): Promise<RenameTagResult> {
  return await client.mutation(renameTagRef, args)
}

export async function findTag(args: FindTagArgs): Promise<FindTagResult> {
  return await client.query(findTagRef, args)
}

export async function removeTag(args: RemoveTagArgs): Promise<RemoveTagResult> {
  return await client.mutation(removeTagRef, args)
}

export async function saveEntry(args: SaveEntryArgs): Promise<SaveEntryResult> {
  return await client.mutation(saveEntryRef, args)
}

export async function upsertFlow(args: UpsertFlowArgs): Promise<UpsertFlowResult> {
  return await client.mutation(upsertFlowRef, args)
}

export async function getActiveFlow(args: GetActiveFlowArgs): Promise<GetActiveFlowResult> {
  return await client.query(getActiveFlowRef, args)
}

export async function completeTagFlow(args: CompleteTagFlowArgs): Promise<CompleteTagFlowResult> {
  return await client.mutation(completeTagFlowRef, args)
}

export async function completeTagFlowById(args: CompleteTagFlowByIdArgs): Promise<CompleteTagFlowByIdResult> {
  return await client.mutation(completeTagFlowByIdRef, args)
}

export async function completeDescriptionFlow(args: CompleteDescriptionFlowArgs): Promise<CompleteDescriptionFlowResult> {
  return await client.mutation(completeDescriptionFlowRef, args)
}

export async function cancelTagFlow(args: CancelTagFlowArgs): Promise<CancelTagFlowResult> {
  return await client.mutation(cancelTagFlowRef, args)
}

export async function incrementErrorCounter(telegramId: number): Promise<IncrementErrorCounterResult> {
  return await client.mutation(incrementErrorCounterRef, {telegramId})
}

export async function recordBotEvent(args: RecordBotEventArgs): Promise<RecordBotEventResult> {
  return await client.mutation(recordBotEventRef, args)
}
