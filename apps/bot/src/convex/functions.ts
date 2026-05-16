import {makeFunctionReference} from 'convex/server'

export type ChatKind = 'bot' | 'group' | 'supergroup'

type NullableString = string | null

export type UserIdentityPayload = {
  telegramId: number
  chatId: number
  chatKind: ChatKind
  isBotAccount: boolean
  username: NullableString
  firstName: NullableString
  lastName: NullableString
  languageCode: NullableString
  isPremium: boolean | null
  timezone: NullableString
  locale: NullableString
}

export type RegisterOnStartArgs = UserIdentityPayload & {
  startPayload: NullableString
  registrationSource: string
}

export type RegisterOnStartResult = {
  status: 'created' | 'updated'
  userId: string
}

export const registerOnStartRef = makeFunctionReference<'mutation', RegisterOnStartArgs, RegisterOnStartResult>('tables/users:registerFromTelegramStart')

export type TouchOnTextResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const touchOnTextRef = makeFunctionReference<'mutation', UserIdentityPayload, TouchOnTextResult>('tables/users:touchFromTelegramText')

export type TouchOnCommandResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const touchOnCommandRef = makeFunctionReference<'mutation', UserIdentityPayload, TouchOnCommandResult>('tables/users:touchFromTelegramCommand')

export type ListTagsArgs = {
  userId: string
  limit?: number
}

export type ListTagsResult = Array<{
  id: string
  name: string
  slug: string
}>

type ListTagsQueryResult = Array<{
  _id: string
  name: string
  slug: string
}>

export const listTagsRef = makeFunctionReference<'query', ListTagsArgs, ListTagsQueryResult>('tables/tags:listByUser')

export type CountInboxArgs = {
  userId: string
  limit?: number
}

export type CountInboxResult = {
  count: number
  isTruncated: boolean
}

export const countInboxRef = makeFunctionReference<'query', CountInboxArgs, CountInboxResult>('tables/entries:countInbox')

export type NextInboxArgs = {
  userId: string
}

export type NextInboxResult =
  | {
      status: 'empty'
    }
  | {
      status: 'found'
      entry: {
        id: string
        kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
        text: string | null
        description: string | null
        url: string | null
        createdAt: number
      }
    }

export const getNextInboxRef = makeFunctionReference<'query', NextInboxArgs, NextInboxResult>('tables/entries:getNextInbox')

export type SearchEntriesArgs = {
  userId: string
  text?: string | null
  tags?: string[]
  kind?: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported' | null
  limit?: number
}

export type SearchEntriesResult = {
  items: Array<{
    id: string
    kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
    status: 'inbox' | 'saved'
    text: string | null
    description: string | null
    url: string | null
    createdAt: number
    tags: string[]
  }>
  isTruncated: boolean
}

export const searchEntriesRef = makeFunctionReference<'query', SearchEntriesArgs, SearchEntriesResult>('tables/entries:search')

export type CreatePageFromTagArgs = {
  userId: string
  tag: string
}

export type CreatePageFromTagResult =
  | {
      status: 'created' | 'existing'
      pageId: string
      shareSlug: string
      title: string
      activeEntryCount: number
    }
  | {
      status: 'invalid_tag' | 'missing_tag' | 'empty_tag'
    }

export const createPageFromTagRef = makeFunctionReference<'mutation', CreatePageFromTagArgs, CreatePageFromTagResult>('tables/pages:createFromTag')

export type EnsureTagArgs = {
  userId: string
  tag: string
}

export type EnsureTagResult = {status: 'created' | 'existing'; tagId: string} | {status: 'invalid'}

export const ensureTagRef = makeFunctionReference<'mutation', EnsureTagArgs, EnsureTagResult>('tables/tags:ensure')

export type RenameTagArgs = {
  userId: string
  fromTag: string
  toTag: string
}

export type RenameTagResult = {status: 'renamed'; tagId: string; name: string; slug: string} | {status: 'source_missing' | 'target_exists' | 'invalid'}

export const renameTagRef = makeFunctionReference<'mutation', RenameTagArgs, RenameTagResult>('tables/tags:rename')

export type FindTagArgs = {
  userId: string
  tag: string
}

export type FindTagResult = {status: 'found'; tag: {id: string; name: string; slug: string}} | {status: 'missing'} | {status: 'invalid'}

type FindTagQueryResult = {status: 'found'; tag: {id: string; name: string; slug: string}} | {status: 'missing'} | {status: 'invalid'}

export const findTagRef = makeFunctionReference<'query', FindTagArgs, FindTagQueryResult>('tables/tags:findBySlug')

export type RemoveTagArgs = {
  userId: string
  tagId: string
}

export type RemoveTagResult = {status: 'deleted'; tagName: string; linkCount: number} | {status: 'missing'}

export const removeTagRef = makeFunctionReference<'mutation', RemoveTagArgs, RemoveTagResult>('tables/tags:removeForUser')

export type SaveEntryArgs = {
  userId: string
  sourceChatId: number
  sourceMessageId: number
  kind: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported'
  text: string | null
  description: string | null
  descriptionSource?: 'none' | 'text' | 'caption' | 'user' | 'ai'
  url: string | null
  tags: string[]
  telegram?: {
    type: string
    context: {
      forwardOrigin: string | null
      forwardDate: number | null
      replyToMessageId: number | null
    }
    file: {
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
  }
}

export type SaveEntryResult = {
  status: 'created' | 'duplicate'
  entryId: string
  entryStatus: 'inbox' | 'saved' | 'archived'
  tagIds: string[]
}

export const saveEntryRef = makeFunctionReference<'mutation', SaveEntryArgs, SaveEntryResult>('tables/entries:save')

export type UpdateEntryFromEditArgs = SaveEntryArgs

export type UpdateEntryFromEditResult =
  | {
      status: 'no_existing'
    }
  | {
      status: 'updated'
      entryId: string
      entryStatus: 'inbox' | 'saved' | 'archived'
      tagIds: string[]
    }

export const updateEntryFromEditRef = makeFunctionReference<'mutation', UpdateEntryFromEditArgs, UpdateEntryFromEditResult>('tables/entries:updateFromTelegramEdit')

export type ArchiveEntryBySourceMessageArgs = {
  userId: string
  sourceChatId: number
  sourceMessageId: number
}

export type ArchiveEntryBySourceMessageResult =
  | {
      status: 'missing'
    }
  | {
      status: 'archived'
      entryId: string
    }

export const archiveEntryBySourceMessageRef = makeFunctionReference<'mutation', ArchiveEntryBySourceMessageArgs, ArchiveEntryBySourceMessageResult>('tables/entries:archiveBySourceMessage')

export type UpsertFlowArgs = {
  userId: string
  chatId: number
  kind: 'tag' | 'description'
  entryId: string
}

export type UpsertFlowResult = {
  status: 'created' | 'replaced'
  flowId: string
}

export const upsertFlowRef = makeFunctionReference<'mutation', UpsertFlowArgs, UpsertFlowResult>('tables/flows:upsertActive')

export type GetActiveFlowArgs = {
  userId: string
  chatId: number
}

export type GetActiveFlowResult =
  | {
      status: 'none'
    }
  | {
      status: 'active'
      flowId: string
      kind: 'tag' | 'description'
      entryId: string | null
    }

export const getActiveFlowRef = makeFunctionReference<'query', GetActiveFlowArgs, GetActiveFlowResult>('tables/flows:getActive')

export type CompleteTagFlowArgs = {
  userId: string
  chatId: number
  tags: string[]
}

export type CompleteTagFlowResult = {status: 'no_active'} | {status: 'invalid_tag'; flowId: string; entryId: string} | {status: 'tagged'; flowId: string; entryId: string; tagIds: string[]}

export const completeTagFlowRef = makeFunctionReference<'mutation', CompleteTagFlowArgs, CompleteTagFlowResult>('tables/flows:completeTag')

export type CompleteTagFlowByIdArgs = {
  userId: string
  chatId: number
  tagId: string
}

export type CompleteTagFlowByIdResult = {status: 'no_active'} | {status: 'missing_tag'} | {status: 'tagged'; flowId: string; entryId: string; tagId: string; tagName: string}

export const completeTagFlowByIdRef = makeFunctionReference<'mutation', CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult>('tables/flows:completeTagById')

export type CompleteDescriptionFlowArgs = {
  userId: string
  chatId: number
  description: string
}

export type CompleteDescriptionFlowResult =
  | {
      status: 'no_active'
    }
  | {
      status: 'invalid_description'
      flowId: string
      entryId: string
    }
  | {
      status: 'described'
      flowId: string
      entryId: string
      description: string
    }

export const completeDescriptionFlowRef = makeFunctionReference<'mutation', CompleteDescriptionFlowArgs, CompleteDescriptionFlowResult>('tables/flows:completeDescription')

export type CancelTagFlowArgs = {
  userId: string
  chatId: number
  entryId: string
}

export type CancelTagFlowResult = {status: 'no_active'} | {status: 'cancelled'; flowId: string; entryId: string}

export const cancelTagFlowRef = makeFunctionReference<'mutation', CancelTagFlowArgs, CancelTagFlowResult>('tables/flows:cancelForEntry')

export type IncrementErrorCounterArgs = {
  telegramId: number
}

export type IncrementErrorCounterResult = {status: 'updated'; userId: string} | {status: 'not_registered'}

export const incrementErrorCounterRef = makeFunctionReference<'mutation', IncrementErrorCounterArgs, IncrementErrorCounterResult>('tables/users:incrementTelegramErrorCounter')

export type BotEventContext = {
  updateId: number | null
  messageId: number | null
  textLength: number | null
  errorName: string | null
  reason: string | null
}

export type RecordBotEventArgs = {
  userId?: string | null
  telegramId?: number | null
  chatId?: number | null
  chatKind?: ChatKind | null
  kind: 'command' | 'message' | 'flow' | 'entry' | 'error' | 'system'
  action: string
  status: 'ok' | 'ignored' | 'rejected' | 'error'
  command?: string | null
  messageKind?: 'text' | 'link' | 'photo' | 'voice' | 'audio' | 'document' | 'video' | 'sticker' | 'unsupported' | null
  entryId?: string | null
  flowId?: string | null
  context?: BotEventContext
}

export type RecordBotEventResult = {
  eventId: string
}

export const recordBotEventRef = makeFunctionReference<'mutation', RecordBotEventArgs, RecordBotEventResult>('tables/botEvents:record')
