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
    command: 'inbox',
    description: 'Разобрать входящие',
  },
  {
    command: 'inbox_count',
    description: 'Сколько во входящих',
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
  {
    command: 'delete',
    description: 'Убрать материал',
  },
]
