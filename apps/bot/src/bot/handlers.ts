import {type Bot, type Context} from 'grammy'

import type {RecordBotEventArgs, UserIdentityPayload} from '@/convex/functions'
import {BOTS_NOT_SUPPORTED_MESSAGE, HELP_MESSAGE, INTERNAL_ERROR_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE} from '@/bot/messages'

import {env} from '@/config/env'
import {getUserIdentity} from '@/bot/context'
import {handleStart, handleText, readStartPayload} from '@/bot/flow'
import {incrementErrorCounter, recordBotEvent, registerOnStart, saveEntry, touchOnText, upsertFlow} from '@/convex/client'

const botDataClient = {
  registerOnStart,
  touchOnText,
  saveEntry,
  upsertFlow,
}

function withRuntimeLabel(text: string): string {
  if (env.runtime === 'prod') return text
  return `${text}\n\n[${env.runtime}]`
}

async function reply(ctx: Context, text: string): Promise<void> {
  await ctx.reply(withRuntimeLabel(text))
}

async function safelyIncrementErrorCounter(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (typeof telegramId !== 'number') return

  try {
    await incrementErrorCounter(telegramId)
  } catch (error) {
    console.error(`${env.logPrefix} failed to increment errorsCount`, error)
  }
}

function getEventContext(ctx: Context, options: {textLength?: number | null; error?: unknown; reason?: string | null} = {}): NonNullable<RecordBotEventArgs['context']> {
  return {
    updateId: ctx.update.update_id ?? null,
    messageId: ctx.message?.message_id ?? null,
    textLength: options.textLength ?? null,
    errorName: options.error instanceof Error ? options.error.name : null,
    reason: options.reason ?? null,
  }
}

function getEventActor(identity: UserIdentityPayload | null): Pick<RecordBotEventArgs, 'telegramId' | 'chatId' | 'chatKind'> {
  return {
    telegramId: identity?.telegramId ?? null,
    chatId: identity?.chatId ?? null,
    chatKind: identity?.chatKind ?? null,
  }
}

async function safelyRecordBotEvent(args: RecordBotEventArgs): Promise<void> {
  try {
    await recordBotEvent(args)
  } catch (error) {
    console.error(`${env.logPrefix} failed to record bot event`, error)
  }
}

function logHandledCommand(command: string, identity: UserIdentityPayload): void {
  console.log(`${env.logPrefix} command=${command} telegramId=${identity.telegramId} chatId=${identity.chatId} chatKind=${identity.chatKind}`)
}

function logHandledText(identity: UserIdentityPayload, text: string): void {
  console.log(`${env.logPrefix} message:text telegramId=${identity.telegramId} chatId=${identity.chatId} chatKind=${identity.chatKind} length=${text.length}`)
}

export function registerBotHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/start', identity)
    }

    try {
      const result = await handleStart(
        {
          identity,
          startPayload: readStartPayload(ctx.match),
        },
        botDataClient,
      )
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'start',
        status: identity === null || identity.isBotAccount ? 'rejected' : 'ok',
        command: '/start',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: identity === null ? 'invalid_context' : identity.isBotAccount ? 'bot_account' : null,
        }),
      })
      await reply(ctx, result.text)
    } catch (error) {
      console.error(`${env.logPrefix} command=/start failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'start_failed',
        status: 'error',
        command: '/start',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('help', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null) {
      logHandledCommand('/help', identity)
    } else {
      console.log(`${env.logPrefix} command=/help handled without identity`)
    }
    await safelyRecordBotEvent({
      ...getEventActor(identity),
      kind: 'command',
      action: 'help',
      status: 'ok',
      command: '/help',
      context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null}),
    })
    await reply(ctx, HELP_MESSAGE)
  })

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    const identity = getUserIdentity(ctx)

    try {
      const result = await handleText({identity, messageId: ctx.message.message_id, text}, botDataClient)
      if (result.type === 'ignored_command') {
        if (identity !== null) {
          logHandledCommand(result.command, identity)
        } else {
          console.log(`${env.logPrefix} command=${result.command} handled without identity`)
        }
        await safelyRecordBotEvent({
          ...getEventActor(identity),
          kind: 'command',
          action: 'ignored_text_command',
          status: 'ignored',
          command: result.command,
          context: getEventContext(ctx, {textLength: text.length}),
        })
        return
      }

      if (identity !== null && !identity.isBotAccount) {
        logHandledText(identity, text)
      }

      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'message',
        action: 'text',
        status: result.text === INVALID_CONTEXT_MESSAGE || result.text === BOTS_NOT_SUPPORTED_MESSAGE || result.text === NOT_REGISTERED_MESSAGE ? 'rejected' : 'ok',
        messageKind: 'text',
        context: getEventContext(ctx, {
          textLength: text.length,
          reason: result.text === INVALID_CONTEXT_MESSAGE ? 'invalid_context' : result.text === BOTS_NOT_SUPPORTED_MESSAGE ? 'bot_account' : result.text === NOT_REGISTERED_MESSAGE ? 'not_registered' : null,
        }),
      })
      await reply(ctx, result.text)
    } catch (error) {
      console.error(`${env.logPrefix} message:text handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'text_failed',
        status: 'error',
        messageKind: 'text',
        context: getEventContext(ctx, {textLength: text.length, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.catch(async (error) => {
    console.error(`${env.logPrefix} unhandled grammY error`, error)
    const identity = getUserIdentity(error.ctx)
    await safelyRecordBotEvent({
      ...getEventActor(identity),
      kind: 'error',
      action: 'grammy_unhandled',
      status: 'error',
      context: getEventContext(error.ctx, {error: error.error, reason: 'grammy_unhandled'}),
    })
    await safelyIncrementErrorCounter(error.ctx)
    await reply(error.ctx, INTERNAL_ERROR_MESSAGE)
  })
}
