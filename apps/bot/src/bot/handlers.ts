import {type Bot, type Context} from 'grammy'

import type {UserIdentityPayload} from '@/convex/functions'
import {BOTS_NOT_SUPPORTED_MESSAGE, HELP_MESSAGE, INTERNAL_ERROR_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, START_MESSAGE} from '@/bot/messages'

import {env} from '@/config/env'
import {getUserIdentity} from '@/bot/context'
import {incrementErrorCounter, registerOnStart, touchOnText} from '@/convex/client'

function readStartPayload(match: string | RegExpMatchArray | undefined): string | null {
  if (typeof match !== 'string') return null
  const payload = match.trim()
  return payload.length > 0 ? payload : null
}

function withRuntimeLabel(text: string): string {
  if (env.runtime === 'prod') return text
  return `${text}\n\n[${env.runtime}]`
}

async function reply(ctx: Context, text: string): Promise<void> {
  await ctx.reply(withRuntimeLabel(text))
}

async function safelyIncrementErrorCounter(ctx: Context): Promise<void> {
  const userId = ctx.from?.id
  if (typeof userId !== 'number') return

  try {
    await incrementErrorCounter(userId)
  } catch (error) {
    console.error(`${env.logPrefix} failed to increment errorsCount`, error)
  }
}

function logHandledCommand(command: string, identity: UserIdentityPayload): void {
  console.log(`${env.logPrefix} command=${command} userId=${identity.userId} chatId=${identity.chatId} chatKind=${identity.chatKind}`)
}

function logHandledText(identity: UserIdentityPayload, text: string): void {
  console.log(`${env.logPrefix} message:text userId=${identity.userId} chatId=${identity.chatId} chatKind=${identity.chatKind} length=${text.length}`)
}

export function registerBotHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity === null) {
      await reply(ctx, INVALID_CONTEXT_MESSAGE)
      return
    }

    if (identity.isBotAccount) {
      await reply(ctx, BOTS_NOT_SUPPORTED_MESSAGE)
      return
    }

    logHandledCommand('/start', identity)

    try {
      await registerOnStart({
        ...identity,
        startPayload: readStartPayload(ctx.match),
        registrationSource: 'telegram_start',
      })
      await reply(ctx, START_MESSAGE)
    } catch (error) {
      console.error(`${env.logPrefix} command=/start failed`, error)
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
    await reply(ctx, HELP_MESSAGE)
  })

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    if (text.startsWith('/')) {
      const identity = getUserIdentity(ctx)
      if (identity !== null) {
        logHandledCommand(text.split(/\s+/, 1)[0] ?? text, identity)
      } else {
        console.log(`${env.logPrefix} command=${text.split(/\s+/, 1)[0] ?? text} handled without identity`)
      }
      return
    }

    const identity = getUserIdentity(ctx)
    if (identity === null) {
      await reply(ctx, INVALID_CONTEXT_MESSAGE)
      return
    }

    if (identity.isBotAccount) {
      await reply(ctx, BOTS_NOT_SUPPORTED_MESSAGE)
      return
    }

    logHandledText(identity, text)

    try {
      const result = await touchOnText(identity)
      if (result.status === 'not_registered') {
        await reply(ctx, NOT_REGISTERED_MESSAGE)
        return
      }

      await reply(ctx, text)
    } catch (error) {
      console.error(`${env.logPrefix} message:text handler failed`, error)
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.catch(async (error) => {
    console.error(`${env.logPrefix} unhandled grammY error`, error)
    await safelyIncrementErrorCounter(error.ctx)
    await reply(error.ctx, INTERNAL_ERROR_MESSAGE)
  })
}
