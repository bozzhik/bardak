import {Bot} from 'grammy'

import {env} from '@/config/env'
import {registerBotHandlers} from '@/bot/handlers'

export function initBot(): Bot {
  const bot = new Bot(env.botToken)
  registerBotHandlers(bot)
  return bot
}
