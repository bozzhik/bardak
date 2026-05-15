import {ConvexHttpClient} from 'convex/browser'

import {env} from '@/config/env'
import {incrementErrorCounterRef, type IncrementErrorCounterResult, recordBotEventRef, type RecordBotEventArgs, type RecordBotEventResult, registerOnStartRef, type RegisterOnStartArgs, type RegisterOnStartResult, touchOnTextRef, type TouchOnTextResult, type UserIdentityPayload} from '@/convex/functions'

const client = new ConvexHttpClient(env.convexUrl)

export async function registerOnStart(args: RegisterOnStartArgs): Promise<RegisterOnStartResult> {
  return await client.mutation(registerOnStartRef, args)
}

export async function touchOnText(args: UserIdentityPayload): Promise<TouchOnTextResult> {
  return await client.mutation(touchOnTextRef, args)
}

export async function incrementErrorCounter(telegramId: number): Promise<IncrementErrorCounterResult> {
  return await client.mutation(incrementErrorCounterRef, {telegramId})
}

export async function recordBotEvent(args: RecordBotEventArgs): Promise<RecordBotEventResult> {
  return await client.mutation(recordBotEventRef, args)
}
