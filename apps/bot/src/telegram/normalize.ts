export type NormalizedTextMessage =
  | {
      kind: 'command'
      command: string
    }
  | {
      kind: 'text'
      text: string
    }

export type EntryKind = 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'

export type DescriptionSource = 'none' | 'text' | 'caption'

export type TelegramContext = {
  forwardOrigin: string | null
  forwardDate: number | null
  replyToMessageId: number | null
}

export type TelegramFile = {
  fileId: string | null
  fileUniqueId: string | null
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
  duration: number | null
  width: number | null
  height: number | null
  emoji: string | null
  setName: string | null
  isAnimated: boolean | null
  isVideo: boolean | null
}

export type TelegramEntryMetadata = {
  type: string
  context: TelegramContext
  file: TelegramFile
}

export type NormalizedEntryMessage = {
  messageId: number
  kind: EntryKind
  text: string | null
  description: string | null
  descriptionSource: DescriptionSource
  url: string | null
  telegram: TelegramEntryMetadata
}

export type NormalizedTelegramMessage =
  | {
      kind: 'command'
      command: string
    }
  | {
      kind: 'entry'
      entry: NormalizedEntryMessage
    }

type TelegramFileLike = {
  file_id: string
  file_unique_id?: string
  file_name?: string
  mime_type?: string
  file_size?: number
  duration?: number
  width?: number
  height?: number
}

type TelegramPhotoLike = TelegramFileLike & {
  width: number
  height: number
}

type TelegramStickerLike = TelegramFileLike & {
  emoji?: string
  set_name?: string
  is_animated?: boolean
  is_video?: boolean
}

type TelegramForwardOriginLike =
  | {
      type: 'user'
      sender_user?: {
        id?: number
        username?: string
      }
      date?: number
    }
  | {
      type: 'hidden_user'
      sender_user_name?: string
      date?: number
    }
  | {
      type: 'chat'
      sender_chat?: {
        id?: number
        title?: string
        username?: string
      }
      date?: number
    }
  | {
      type: 'channel'
      chat?: {
        id?: number
        title?: string
        username?: string
      }
      message_id?: number
      date?: number
    }

export type TelegramMessageLike = {
  message_id: number
  text?: string
  caption?: string
  photo?: TelegramPhotoLike[]
  voice?: TelegramFileLike
  audio?: TelegramFileLike
  document?: TelegramFileLike
  video?: TelegramFileLike
  sticker?: TelegramStickerLike
  forward_origin?: TelegramForwardOriginLike
  forward_date?: number
  reply_to_message?: {
    message_id?: number
  }
  location?: unknown
  contact?: unknown
  poll?: unknown
  venue?: unknown
  dice?: unknown
  animation?: TelegramFileLike
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/iu

const EMPTY_FILE: TelegramFile = {
  fileId: null,
  fileUniqueId: null,
  fileName: null,
  mimeType: null,
  fileSize: null,
  duration: null,
  width: null,
  height: null,
  emoji: null,
  setName: null,
  isAnimated: null,
  isVideo: null,
}

export function normalizeTextMessage(text: string): NormalizedTextMessage {
  if (text.startsWith('/')) {
    return {
      kind: 'command',
      command: text.split(/\s+/, 1)[0] ?? text,
    }
  }

  return {
    kind: 'text',
    text,
  }
}

function firstUrl(text: string): string | null {
  return text.match(URL_RE)?.[0] ?? null
}

function normalizeForwardOrigin(origin: TelegramForwardOriginLike | undefined): string | null {
  if (origin === undefined) return null

  if (origin.type === 'user') {
    const id = origin.sender_user?.id
    const username = origin.sender_user?.username
    return `user:${username ?? id ?? 'unknown'}`
  }

  if (origin.type === 'hidden_user') {
    return `hidden_user:${origin.sender_user_name ?? 'unknown'}`
  }

  if (origin.type === 'chat') {
    const chat = origin.sender_chat
    return `chat:${chat?.username ?? chat?.title ?? chat?.id ?? 'unknown'}`
  }

  if (origin.type === 'channel') {
    const chat = origin.chat
    const source = chat?.username ?? chat?.title ?? chat?.id ?? 'unknown'
    return origin.message_id === undefined ? `channel:${source}` : `channel:${source}:${origin.message_id}`
  }

  return null
}

function normalizeContext(message: TelegramMessageLike): TelegramContext {
  const forwardDate = message.forward_origin?.date ?? message.forward_date ?? null

  return {
    forwardOrigin: normalizeForwardOrigin(message.forward_origin),
    forwardDate: forwardDate === null ? null : forwardDate * 1000,
    replyToMessageId: message.reply_to_message?.message_id ?? null,
  }
}

function normalizeFile(file: TelegramFileLike | TelegramStickerLike | null): TelegramFile {
  if (file === null) return EMPTY_FILE

  return {
    fileId: file.file_id,
    fileUniqueId: file.file_unique_id ?? null,
    fileName: file.file_name ?? null,
    mimeType: file.mime_type ?? null,
    fileSize: file.file_size ?? null,
    duration: file.duration ?? null,
    width: file.width ?? null,
    height: file.height ?? null,
    emoji: 'emoji' in file ? (file.emoji ?? null) : null,
    setName: 'set_name' in file ? (file.set_name ?? null) : null,
    isAnimated: 'is_animated' in file ? (file.is_animated ?? null) : null,
    isVideo: 'is_video' in file ? (file.is_video ?? null) : null,
  }
}

function normalizeCaption(caption: string | undefined): {description: string | null; descriptionSource: DescriptionSource} {
  if (caption === undefined || caption.trim().length === 0) {
    return {description: null, descriptionSource: 'none'}
  }

  return {description: caption, descriptionSource: 'caption'}
}

function largestPhoto(photos: TelegramPhotoLike[]): TelegramPhotoLike {
  return photos.reduce((largest, photo) => (photo.width * photo.height > largest.width * largest.height ? photo : largest), photos[0]!)
}

function createEntry(message: TelegramMessageLike, kind: EntryKind, type: string, file: TelegramFile, text: string | null, description: string | null, descriptionSource: DescriptionSource, url: string | null): NormalizedTelegramMessage {
  return {
    kind: 'entry',
    entry: {
      messageId: message.message_id,
      kind,
      text,
      description,
      descriptionSource,
      url,
      telegram: {
        type,
        context: normalizeContext(message),
        file,
      },
    },
  }
}

function unsupportedType(message: TelegramMessageLike): string {
  if (message.location !== undefined) return 'message:location'
  if (message.contact !== undefined) return 'message:contact'
  if (message.poll !== undefined) return 'message:poll'
  if (message.venue !== undefined) return 'message:venue'
  if (message.dice !== undefined) return 'message:dice'
  if (message.animation !== undefined) return 'message:animation'
  return 'message:unsupported'
}

export function normalizeTelegramMessage(message: TelegramMessageLike): NormalizedTelegramMessage {
  if (message.text !== undefined) {
    const text = normalizeTextMessage(message.text)
    if (text.kind === 'command') return text

    const url = firstUrl(text.text)
    return createEntry(message, url === null ? 'text' : 'link', 'message:text', EMPTY_FILE, text.text, null, 'text', url)
  }

  if (message.photo !== undefined && message.photo.length > 0) {
    const caption = normalizeCaption(message.caption)
    return createEntry(message, 'photo', 'message:photo', normalizeFile(largestPhoto(message.photo)), null, caption.description, caption.descriptionSource, caption.description === null ? null : firstUrl(caption.description))
  }

  if (message.voice !== undefined) {
    const caption = normalizeCaption(message.caption)
    return createEntry(message, 'voice', 'message:voice', normalizeFile(message.voice), null, caption.description, caption.descriptionSource, caption.description === null ? null : firstUrl(caption.description))
  }

  if (message.audio !== undefined) {
    const caption = normalizeCaption(message.caption)
    return createEntry(message, 'audio', 'message:audio', normalizeFile(message.audio), null, caption.description, caption.descriptionSource, caption.description === null ? null : firstUrl(caption.description))
  }

  if (message.document !== undefined) {
    const caption = normalizeCaption(message.caption)
    return createEntry(message, 'document', 'message:document', normalizeFile(message.document), null, caption.description, caption.descriptionSource, caption.description === null ? null : firstUrl(caption.description))
  }

  if (message.video !== undefined) {
    const caption = normalizeCaption(message.caption)
    return createEntry(message, 'video', 'message:video', normalizeFile(message.video), null, caption.description, caption.descriptionSource, caption.description === null ? null : firstUrl(caption.description))
  }

  if (message.sticker !== undefined) {
    return createEntry(message, 'sticker', 'message:sticker', normalizeFile(message.sticker), null, null, 'none', null)
  }

  return createEntry(message, 'unsupported', unsupportedType(message), EMPTY_FILE, null, null, 'none', null)
}
