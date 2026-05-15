import {ConvexHttpClient} from 'convex/browser'

import {env} from '@/config/env'
import {completeTagFlowRef, type CompleteTagFlowArgs, type CompleteTagFlowResult, incrementErrorCounterRef, type IncrementErrorCounterResult, listTagsRef, type ListTagsArgs, type ListTagsResult, recordBotEventRef, type RecordBotEventArgs, type RecordBotEventResult, registerOnStartRef, type RegisterOnStartArgs, type RegisterOnStartResult, saveEntryRef, type SaveEntryArgs, type SaveEntryResult, touchOnCommandRef, type TouchOnCommandResult, touchOnTextRef, type TouchOnTextResult, type UpsertFlowArgs, type UpsertFlowResult, type UserIdentityPayload, upsertFlowRef} from '@/convex/functions'

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

export async function saveEntry(args: SaveEntryArgs): Promise<SaveEntryResult> {
  return await client.mutation(saveEntryRef, args)
}

export async function upsertFlow(args: UpsertFlowArgs): Promise<UpsertFlowResult> {
  return await client.mutation(upsertFlowRef, args)
}

export async function completeTagFlow(args: CompleteTagFlowArgs): Promise<CompleteTagFlowResult> {
  return await client.mutation(completeTagFlowRef, args)
}

export async function incrementErrorCounter(telegramId: number): Promise<IncrementErrorCounterResult> {
  return await client.mutation(incrementErrorCounterRef, {telegramId})
}

export async function recordBotEvent(args: RecordBotEventArgs): Promise<RecordBotEventResult> {
  return await client.mutation(recordBotEventRef, args)
}
