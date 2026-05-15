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
  {
    command: 'tags',
    description: 'Показать теги',
  },
  {
    command: 'tag_new',
    description: 'Создать тег',
  },
  {
    command: 'tag_rename',
    description: 'Переименовать тег',
  },
  {
    command: 'tag_delete',
    description: 'Удалить тег',
  },
]
