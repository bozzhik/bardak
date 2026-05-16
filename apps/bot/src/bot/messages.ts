export const START_MESSAGE = ['Привет! Я на связи и готов к работе', '', 'Если забудешь, что тут есть — загляни в /help'].join('\n')

export const HELP_MESSAGE = ['Коротко, что умею:', '', '/start — запуск бота', '/help — показать справку', '/inbox — разобрать входящие', '/inbox_count — сколько во входящих', '/search договор #tag type:document — поиск', '/tags — список тегов', '/tag_new #tag — создать тег', '/tag_rename #old #new — переименовать тег', '/tag_delete #tag — удалить тег', '/delete — убрать материал через reply'].join('\n')

export const NOT_REGISTERED_MESSAGE = 'Сначала нужно запустить бота с помощью /start'
export const INVALID_CONTEXT_MESSAGE = 'Не вышло разобраться, кто ты или какой чат. Попробуй ещё раз или напиши разарботчику – @bozzhik'
export const BOTS_NOT_SUPPORTED_MESSAGE = 'Не могу обработать эту команду'
export const PRIVATE_ONLY_MESSAGE = 'Пока сохраняю только в личном чате. Напиши мне напрямую.'
export const INTERNAL_ERROR_MESSAGE = 'Что-то сломалось с моей стороны. Попробуй чуть позже или напиши разарботчику – @bozzhik'
export const SAVED_TO_INBOX_MESSAGE = 'Сохранил во входящие. Напиши тег в формате #example.'
export const NEED_DESCRIPTION_MESSAGE = 'Сохранил во входящие. Опиши материал несколькими словами, чтобы я мог найти его позже.'
export const UNSUPPORTED_DESCRIPTION_MESSAGE = 'Пока не умею разобрать этот тип. Опиши его несколькими словами, и я сохраню описание.'
export const DESCRIPTION_SAVED_MESSAGE = 'Сохранил описание. Теперь напиши тег в формате #example или оставь во входящих.'
export const ACTIVE_FLOW_MESSAGE = 'Сначала закончим предыдущий материал: напиши описание или тег, потом пришли новый материал.'
export const EDITED_ENTRY_MESSAGE = 'Обновил сохранённый материал.'
export const EDITED_ENTRY_NOT_FOUND_MESSAGE = 'Не нашёл сохранённый материал для обновления.'
export const DELETE_REPLY_USAGE_MESSAGE = 'Ответь командой /delete на материал, который нужно убрать.'
export const ENTRY_ARCHIVED_MESSAGE = 'Убрал материал из активных.'
export const ENTRY_NOT_FOUND_MESSAGE = 'Не нашёл сохранённый материал.'
export const SEARCH_USAGE_MESSAGE = 'Напиши запрос: /search текст, /search #tag или /search type:photo.'
export const SEARCH_EMPTY_MESSAGE = 'Ничего не нашёл.'
export const SEARCH_INVALID_KIND_MESSAGE = 'Не знаю такой тип. Используй text, link, photo, voice, audio, document, video, sticker или unsupported.'
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

type SearchEntryForMessage = {
  kind: string
  text: string | null
  description: string | null
  url: string | null
  tags: string[]
}

function searchEntryPreview(entry: SearchEntryForMessage): string {
  return entry.text ?? entry.description ?? entry.url ?? 'Без описания'
}

export function searchResultsMessage(entries: SearchEntryForMessage[], isTruncated: boolean): string {
  const rows = entries.map((entry, index) => {
    const tags = entry.tags.length === 0 ? '' : ` ${entry.tags.map((tag) => `#${tag}`).join(' ')}`
    return `${index + 1}. ${entry.kind} — ${searchEntryPreview(entry)}${tags}`
  })

  return ['Нашёл:', '', ...rows, ...(isTruncated ? ['', 'Показал первые результаты. Уточни запрос, если нужно.'] : [])].join('\n')
}
