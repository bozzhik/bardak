import type {BotCommand} from 'grammy/types'

export const botCommands: BotCommand[] = [
  {
    command: 'start',
    description: 'Запуск бота',
  },
  {
    command: 'help',
    description: 'Показать справку',
  },
]
