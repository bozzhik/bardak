import {Bot, type Context} from 'grammy'

import {TELEGRAM_BOT_TOKEN} from './config.js'
import {saveIncomingContent, type IncomingContentKind, upsertTelegramUser} from './convex-client.js'

const linkRegex = /(https?:\/\/[^\s]+)/i

const extractFirstLink = (text: string): string | undefined => {
  const match = text.match(linkRegex)
  return match?.[0]
}

const replyWithUsage = async (ctx: Context): Promise<void> => {
  await ctx.reply(
    [
      'Я сохранил сообщение в Bardak.',
      'Поддерживаю текст, ссылки, фото, документы и голосовые.',
      '',
      'Команды:',
      '/start - регистрация и онбординг',
      '/help - список команд',
      '/ping - проверка доступности',
    ].join('\n')
  )
}

const resolveMessagePayload = (ctx: Context): {
  contentType: IncomingContentKind
  text?: string
  payload: Record<string, unknown>
} => {
  const message = ctx.message
  if (!message) {
    return {
      contentType: 'unknown',
      payload: {},
    }
  }

  if (message.forward_origin) {
    return {
      contentType: 'forwarded',
      text: 'text' in message ? message.text : undefined,
      payload: {
        forwardOrigin: message.forward_origin,
      },
    }
  }

  if ('text' in message && message.text) {
    const url = extractFirstLink(message.text)
    if (url) {
      return {
        contentType: 'link',
        text: message.text,
        payload: {
          url,
        },
      }
    }
    return {
      contentType: 'text',
      text: message.text,
      payload: {},
    }
  }

  if ('photo' in message && message.photo && message.photo.length > 0) {
    const bestPhoto = message.photo.at(-1)
    return {
      contentType: 'photo',
      payload: {
        fileId: bestPhoto?.file_id,
        caption: message.caption,
      },
    }
  }

  if ('document' in message && message.document) {
    return {
      contentType: 'document',
      text: message.caption,
      payload: {
        fileId: message.document.file_id,
        fileName: message.document.file_name,
        mimeType: message.document.mime_type,
      },
    }
  }

  if ('voice' in message && message.voice) {
    return {
      contentType: 'voice',
      text: message.caption,
      payload: {
        fileId: message.voice.file_id,
        duration: message.voice.duration,
      },
    }
  }

  return {
    contentType: 'unknown',
    payload: {},
  }
}

const saveMessageToConvex = async (ctx: Context): Promise<void> => {
  if (!ctx.from || !ctx.message || !ctx.chat) {
    return
  }

  await upsertTelegramUser({
    telegramUserId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
  })

  const payload = resolveMessagePayload(ctx)

  await saveIncomingContent({
    telegramUserId: ctx.from.id,
    username: ctx.from.username,
    firstName: ctx.from.first_name,
    lastName: ctx.from.last_name,
    telegramChatId: ctx.chat.id,
    telegramMessageId: ctx.message.message_id,
    contentType: payload.contentType,
    text: payload.text,
    payloadJson: JSON.stringify(payload.payload),
  })
}

export const createBot = (): Bot => {
  const bot = new Bot(TELEGRAM_BOT_TOKEN)

  bot.command('start', async (ctx) => {
    if (ctx.from) {
      await upsertTelegramUser({
        telegramUserId: ctx.from.id,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      })
    }

    await ctx.reply(
      [
        'Привет! Это первичная версия Bardak-бота.',
        'Отправь сообщение, ссылку, фото, документ или голосовое, и я сохраню это в систему.',
        '',
        'Используй /help для списка команд.',
      ].join('\n')
    )
  })

  bot.command('help', replyWithUsage)

  bot.command('ping', async (ctx) => {
    await ctx.reply('pong')
  })

  bot.on('message', async (ctx) => {
    await saveMessageToConvex(ctx)
    try {
      await ctx.api.copyMessage(ctx.chat.id, ctx.chat.id, ctx.message.message_id)
    } catch {
      await ctx.reply('Сообщение сохранено в Convex.')
    }
  })

  bot.catch((error) => {
    console.error('Telegram bot runtime error', error.error)
  })

  return bot
}
