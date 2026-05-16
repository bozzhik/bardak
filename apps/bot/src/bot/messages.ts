export const START_MESSAGE = ['Привет! Я на связи и готов к работе', '', 'Если забудешь, что тут есть — загляни в /help'].join('\n')

export const HELP_MESSAGE = ['Коротко, что умею:', '', '/start — запуск бота', '/help — показать справку', '/inbox — разобрать входящие', '/inbox_count — сколько во входящих', '/tags — список тегов', '/tag_new #tag — создать тег', '/tag_rename #old #new — переименовать тег', '/tag_delete #tag — удалить тег'].join('\n')

export const NOT_REGISTERED_MESSAGE = 'Сначала нужно запустить бота с помощью /start'
export const INVALID_CONTEXT_MESSAGE = 'Не вышло разобраться, кто ты или какой чат. Попробуй ещё раз или напиши разарботчику – @bozzhik'
export const BOTS_NOT_SUPPORTED_MESSAGE = 'Не могу обработать эту команду'
export const INTERNAL_ERROR_MESSAGE = 'Что-то сломалось с моей стороны. Попробуй чуть позже или напиши разарботчику – @bozzhik'
export const SAVED_TO_INBOX_MESSAGE = 'Сохранил во входящие. Напиши тег в формате #example.'
export const TAG_FORMAT_MESSAGE = 'Напиши тег в формате #example.'
export const TAGS_EMPTY_MESSAGE = 'Тегов пока нет. Сохрани материал без тега, затем напиши #example.'
export const TAG_NEW_USAGE_MESSAGE = 'Напиши тег в формате /tag_new #example.'
export const TAG_RENAME_USAGE_MESSAGE = 'Напиши в формате /tag_rename #old #new.'
export const TAG_DELETE_USAGE_MESSAGE = 'Напиши в формате /tag_delete #tag.'
export const TAG_DELETE_CANCELLED_MESSAGE = 'Оставил тег.'
export const NO_ACTIVE_FLOW_MESSAGE = 'Нет материала для разбора.'
export const UNKNOWN_ACTION_MESSAGE = 'Не понял действие.'
export const INBOX_EMPTY_MESSAGE = 'Входящие пустые.'
export const INBOX_SKIPPED_MESSAGE = 'Оставил во входящих.'

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

export function tagCreatedMessage(tag: string): string {
  return `Создал тег #${tag}.`
}

export function tagExistsMessage(tag: string): string {
  return `Тег #${tag} уже есть.`
}

export function tagRenamedMessage(fromTag: string, toTag: string): string {
  return `Переименовал #${fromTag} в #${toTag}.`
}

export function tagNotFoundMessage(tag: string): string {
  return `Тег #${tag} не найден.`
}

export function tagDeleteConfirmMessage(tag: string): string {
  return `Удалить тег #${tag}? Материалы останутся.`
}

export function tagDeletedMessage(tag: string): string {
  return `Удалил тег #${tag}.`
}

export function inboxCountMessage(count: number, isTruncated: boolean): string {
  return `Во входящих: ${count}${isTruncated ? '+' : ''}.`
}

export function inboxItemMessage(preview: string): string {
  return ['Входящие:', '', preview, '', 'Выбери тег, напиши новый #tag или пропусти.'].join('\n')
}
