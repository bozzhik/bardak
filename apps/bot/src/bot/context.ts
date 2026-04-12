import type {Context} from 'grammy'

import type {ChatKind, UserIdentityPayload} from '@/convex/functions'

function toSupportedChatKind(value: string): ChatKind | null {
  if (value === 'private') return 'bot'
  if (value === 'group' || value === 'supergroup') return value
  return null
}

export function getUserIdentity(ctx: Context): UserIdentityPayload | null {
  const from = ctx.from
  const chat = ctx.chat
  if (!from || !chat) return null

  const chatKind = toSupportedChatKind(chat.type)
  if (chatKind === null) return null

  return {
    userId: from.id,
    chatId: chat.id,
    chatKind,
    isBotAccount: from.is_bot,
    username: from.username ?? null,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    languageCode: from.language_code ?? null,
    isPremium: from.is_premium ?? null,
    timezone: null,
    locale: from.language_code ?? null,
  }
}
