import {type Bot, type Context} from 'grammy'

import type {UserIdentityPayload} from '@/convex/functions'
import {HELP_MESSAGE, INTERNAL_ERROR_MESSAGE} from '@/bot/messages'

import {env} from '@/config/env'
import {getUserIdentity} from '@/bot/context'
import {handleStart, handleText, readStartPayload} from '@/bot/flow'
import {incrementErrorCounter, registerOnStart, touchOnText} from '@/convex/client'

const botDataClient = {
  registerOnStart,
  touchOnText,
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
      await reply(ctx, result.text)
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
    const identity = getUserIdentity(ctx)

    try {
      const result = await handleText({identity, text}, botDataClient)
      if (result.type === 'ignored_command') {
        if (identity !== null) {
          logHandledCommand(result.command, identity)
        } else {
          console.log(`${env.logPrefix} command=${result.command} handled without identity`)
        }
        return
      }

      if (identity !== null && !identity.isBotAccount) {
        logHandledText(identity, text)
      }

      await reply(ctx, result.text)
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
