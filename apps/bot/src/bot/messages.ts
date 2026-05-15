export const START_MESSAGE = ['Привет! Я на связи и готов к работе', '', 'Если забудешь, что тут есть — загляни в /help'].join('\n')

export const HELP_MESSAGE = ['Коротко, что умею:', '', '/start — запуск бота', '/help — показать справку', '/tags — список тегов'].join('\n')

export const NOT_REGISTERED_MESSAGE = 'Сначала нужно запустить бота с помощью /start'
export const INVALID_CONTEXT_MESSAGE = 'Не вышло разобраться, кто ты или какой чат. Попробуй ещё раз или напиши разарботчику – @bozzhik'
export const BOTS_NOT_SUPPORTED_MESSAGE = 'Не могу обработать эту команду'
export const INTERNAL_ERROR_MESSAGE = 'Что-то сломалось с моей стороны. Попробуй чуть позже или напиши разарботчику – @bozzhik'
export const SAVED_TO_INBOX_MESSAGE = 'Сохранил во входящие. Напиши тег в формате #example.'
export const TAG_FORMAT_MESSAGE = 'Напиши тег в формате #example.'
export const TAGS_EMPTY_MESSAGE = 'Тегов пока нет. Сохрани материал без тега, затем напиши #example.'

type TagForMessage = {
  name: string
}

export function savedWithTagsMessage(tags: string[]): string {
  if (tags.length === 1) return `Сохранил с тегом ${tags[0]}.`
  return `Сохранил с тегами ${tags.join(' ')}.`
}

export function tagsListMessage(tags: TagForMessage[]): string {
  return ['Твои теги:', '', ...tags.map((tag) => `#${tag.name}`)].join('\n')
}
