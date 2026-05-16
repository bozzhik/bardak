import {type Bot, type Context} from 'grammy'

import type {RecordBotEventArgs, UserIdentityPayload} from '@/convex/functions'
import {BOTS_NOT_SUPPORTED_MESSAGE, HELP_MESSAGE, INBOX_EMPTY_MESSAGE, INTERNAL_ERROR_MESSAGE, INVALID_CONTEXT_MESSAGE, NOT_REGISTERED_MESSAGE, PRIVATE_ONLY_MESSAGE, TAG_DELETE_USAGE_MESSAGE, TAG_NEW_USAGE_MESSAGE, TAG_RENAME_USAGE_MESSAGE} from '@/bot/messages'

import {env} from '@/config/env'
import {getUserIdentity} from '@/bot/context'
import {handleCallback, handleDelete, handleEditedMessage, handleInbox, handleInboxCount, handleMessage, handleStart, handleTagDelete, handleTagNew, handleTagRename, handleTags, handleTextMessage, readStartPayload, type ReplyButton, type ReplyResult} from '@/bot/flow'
import {archiveEntryBySourceMessage, cancelTagFlow, completeDescriptionFlow, completeTagFlow, completeTagFlowById, countInbox, ensureTag, findTag, getActiveFlow, getNextInbox, incrementErrorCounter, listTags, recordBotEvent, registerOnStart, removeTag, renameTag, saveEntry, touchOnCommand, touchOnText, updateEntryFromEdit, upsertFlow} from '@/convex/client'
import {normalizeTelegramMessage, type EntryKind, type TelegramMessageLike} from '@/telegram/normalize'

const botDataClient = {
  registerOnStart,
  touchOnText,
  touchOnCommand,
  listTags,
  countInbox,
  getNextInbox,
  ensureTag,
  renameTag,
  findTag,
  removeTag,
  completeTagFlow,
  completeTagFlowById,
  completeDescriptionFlow,
  cancelTagFlow,
  saveEntry,
  updateEntryFromEdit,
  archiveEntryBySourceMessage,
  upsertFlow,
  getActiveFlow,
}

function withRuntimeLabel(text: string): string {
  if (env.runtime === 'prod') return text
  return `${text}\n\n[${env.runtime}]`
}

function toReplyMarkup(buttons: ReplyButton[][]): {inline_keyboard: Array<Array<{text: string; callback_data: string}>>} {
  return {
    inline_keyboard: buttons.map((row) => row.map((button) => ({text: button.text, callback_data: button.data}))),
  }
}

async function reply(ctx: Context, text: string, buttons?: ReplyButton[][]): Promise<void> {
  if (buttons === undefined) {
    await ctx.reply(withRuntimeLabel(text))
    return
  }

  await ctx.reply(withRuntimeLabel(text), {
    reply_markup: toReplyMarkup(buttons),
  })
}

async function replyWithResult(ctx: Context, result: ReplyResult): Promise<void> {
  await reply(ctx, result.text, result.buttons)
}

function isRejectedText(text: string): boolean {
  return text === INVALID_CONTEXT_MESSAGE || text === BOTS_NOT_SUPPORTED_MESSAGE || text === PRIVATE_ONLY_MESSAGE || text === NOT_REGISTERED_MESSAGE || text === TAG_NEW_USAGE_MESSAGE || text === TAG_RENAME_USAGE_MESSAGE || text === TAG_DELETE_USAGE_MESSAGE
}

function rejectedReason(text: string): string | null {
  if (text === INVALID_CONTEXT_MESSAGE) return 'invalid_context'
  if (text === BOTS_NOT_SUPPORTED_MESSAGE) return 'bot_account'
  if (text === PRIVATE_ONLY_MESSAGE) return 'private_only'
  if (text === NOT_REGISTERED_MESSAGE) return 'not_registered'
  if (text === TAG_NEW_USAGE_MESSAGE || text === TAG_RENAME_USAGE_MESSAGE || text === TAG_DELETE_USAGE_MESSAGE) return 'invalid_tag'
  return null
}

async function safelyIncrementErrorCounter(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id
  if (typeof telegramId !== 'number') return

  try {
    await incrementErrorCounter(telegramId)
  } catch (error) {
    console.error(`${env.logPrefix} failed to increment errorsCount`, error)
  }
}

function getEventContext(ctx: Context, options: {textLength?: number | null; error?: unknown; reason?: string | null} = {}): NonNullable<RecordBotEventArgs['context']> {
  return {
    updateId: ctx.update.update_id ?? null,
    messageId: ctx.message?.message_id ?? null,
    textLength: options.textLength ?? null,
    errorName: options.error instanceof Error ? options.error.name : null,
    reason: options.reason ?? null,
  }
}

function getEventActor(identity: UserIdentityPayload | null): Pick<RecordBotEventArgs, 'telegramId' | 'chatId' | 'chatKind'> {
  return {
    telegramId: identity?.telegramId ?? null,
    chatId: identity?.chatId ?? null,
    chatKind: identity?.chatKind ?? null,
  }
}

async function safelyRecordBotEvent(args: RecordBotEventArgs): Promise<void> {
  try {
    await recordBotEvent(args)
  } catch (error) {
    console.error(`${env.logPrefix} failed to record bot event`, error)
  }
}

function logHandledCommand(command: string, identity: UserIdentityPayload): void {
  console.log(`${env.logPrefix} command=${command} telegramId=${identity.telegramId} chatId=${identity.chatId} chatKind=${identity.chatKind}`)
}

function logHandledText(identity: UserIdentityPayload, text: string): void {
  console.log(`${env.logPrefix} message:text telegramId=${identity.telegramId} chatId=${identity.chatId} chatKind=${identity.chatKind} length=${text.length}`)
}

function logHandledMessage(identity: UserIdentityPayload, kind: EntryKind): void {
  console.log(`${env.logPrefix} message:${kind} telegramId=${identity.telegramId} chatId=${identity.chatId} chatKind=${identity.chatKind}`)
}

async function handleCapturableMessage(ctx: Context, message: TelegramMessageLike): Promise<void> {
  const identity = getUserIdentity(ctx)
  const normalized = normalizeTelegramMessage(message)

  if (normalized.kind === 'command') {
    if (identity !== null) {
      logHandledCommand(normalized.command, identity)
    } else {
      console.log(`${env.logPrefix} command=${normalized.command} handled without identity`)
    }
    await safelyRecordBotEvent({
      ...getEventActor(identity),
      kind: 'command',
      action: 'ignored_text_command',
      status: 'ignored',
      command: normalized.command,
      context: getEventContext(ctx, {textLength: message.text?.length ?? null}),
    })
    return
  }

  const result = normalized.entry.kind === 'text' || normalized.entry.kind === 'link' ? await handleTextMessage({identity, message: normalized.entry}, botDataClient) : await handleMessage({identity, message: normalized.entry}, botDataClient)
  if (identity !== null && !identity.isBotAccount) {
    if (normalized.entry.kind === 'text' && normalized.entry.text !== null) {
      logHandledText(identity, normalized.entry.text)
    } else {
      logHandledMessage(identity, normalized.entry.kind)
    }
  }

  await safelyRecordBotEvent({
    ...getEventActor(identity),
    kind: 'message',
    action: normalized.entry.kind,
    status: isRejectedText(result.text) ? 'rejected' : 'ok',
    messageKind: normalized.entry.kind,
    context: getEventContext(ctx, {
      textLength: normalized.entry.text?.length ?? normalized.entry.description?.length ?? null,
      reason: rejectedReason(result.text),
    }),
  })
  await replyWithResult(ctx, result)
}

async function handleEditedCapturableMessage(ctx: Context, message: TelegramMessageLike): Promise<void> {
  const identity = getUserIdentity(ctx)
  const normalized = normalizeTelegramMessage(message)
  if (normalized.kind === 'command') return

  const result = await handleEditedMessage({identity, message: normalized.entry}, botDataClient)
  await safelyRecordBotEvent({
    ...getEventActor(identity),
    kind: 'message',
    action: 'edited',
    status: isRejectedText(result.text) ? 'rejected' : 'ok',
    messageKind: normalized.entry.kind,
    context: getEventContext(ctx, {
      textLength: normalized.entry.text?.length ?? normalized.entry.description?.length ?? null,
      reason: rejectedReason(result.text),
    }),
  })
  await replyWithResult(ctx, result)
}

export function registerBotHandlers(bot: Bot): void {
  bot.command('start', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/start', identity)
    }

    try {
      const result = await handleStart(
        {
          identity,
          startPayload: readStartPayload(ctx.match),
        },
        botDataClient,
      )
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'start',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/start',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: rejectedReason(result.text),
        }),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/start failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'start_failed',
        status: 'error',
        command: '/start',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('help', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null) {
      logHandledCommand('/help', identity)
    } else {
      console.log(`${env.logPrefix} command=/help handled without identity`)
    }
    await safelyRecordBotEvent({
      ...getEventActor(identity),
      kind: 'command',
      action: 'help',
      status: 'ok',
      command: '/help',
      context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null}),
    })
    await reply(ctx, HELP_MESSAGE)
  })

  bot.command('inbox_count', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/inbox_count', identity)
    }

    try {
      const result = await handleInboxCount({identity}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'inbox_count',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/inbox_count',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: rejectedReason(result.text),
        }),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/inbox_count failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'inbox_count_failed',
        status: 'error',
        command: '/inbox_count',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('inbox', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/inbox', identity)
    }

    try {
      const result = await handleInbox({identity}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'inbox',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/inbox',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: rejectedReason(result.text) ?? (result.text === INBOX_EMPTY_MESSAGE ? 'empty' : null),
        }),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/inbox failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'inbox_failed',
        status: 'error',
        command: '/inbox',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('tags', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/tags', identity)
    }

    try {
      const result = await handleTags({identity}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'tags',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/tags',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: rejectedReason(result.text),
        }),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/tags failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'tags_failed',
        status: 'error',
        command: '/tags',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('tag_new', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/tag_new', identity)
    }

    try {
      const result = await handleTagNew({identity, tag: readStartPayload(ctx.match)}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'tag_new',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/tag_new',
        context: getEventContext(ctx, {
          textLength: ctx.message?.text?.length ?? null,
          reason: rejectedReason(result.text),
        }),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/tag_new failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'tag_new_failed',
        status: 'error',
        command: '/tag_new',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('tag_rename', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/tag_rename', identity)
    }

    try {
      const result = await handleTagRename({identity, payload: readStartPayload(ctx.match)}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'tag_rename',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/tag_rename',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, reason: rejectedReason(result.text)}),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/tag_rename failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'tag_rename_failed',
        status: 'error',
        command: '/tag_rename',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('tag_delete', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/tag_delete', identity)
    }

    try {
      const result = await handleTagDelete({identity, tag: readStartPayload(ctx.match)}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'tag_delete',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/tag_delete',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, reason: rejectedReason(result.text)}),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/tag_delete failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'tag_delete_failed',
        status: 'error',
        command: '/tag_delete',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.command('delete', async (ctx) => {
    const identity = getUserIdentity(ctx)
    if (identity !== null && !identity.isBotAccount) {
      logHandledCommand('/delete', identity)
    }

    try {
      const result = await handleDelete({identity, replyToMessageId: ctx.message?.reply_to_message?.message_id ?? null}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'delete',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        command: '/delete',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, reason: rejectedReason(result.text)}),
      })
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} command=/delete failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'delete_failed',
        status: 'error',
        command: '/delete',
        context: getEventContext(ctx, {textLength: ctx.message?.text?.length ?? null, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text
    const identity = getUserIdentity(ctx)

    try {
      await handleCapturableMessage(ctx, ctx.message)
    } catch (error) {
      console.error(`${env.logPrefix} message:text handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'text_failed',
        status: 'error',
        messageKind: 'text',
        context: getEventContext(ctx, {textLength: text.length, error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.on('edited_message', async (ctx) => {
    const editedMessage = ctx.editedMessage
    if (editedMessage === undefined) return

    try {
      await handleEditedCapturableMessage(ctx, editedMessage)
    } catch (error) {
      const identity = getUserIdentity(ctx)
      console.error(`${env.logPrefix} edited message handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'edited_failed',
        status: 'error',
        context: getEventContext(ctx, {error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.on(['message:photo', 'message:voice', 'message:audio', 'message:document', 'message:video', 'message:sticker'], async (ctx) => {
    try {
      await handleCapturableMessage(ctx, ctx.message)
    } catch (error) {
      const identity = getUserIdentity(ctx)
      console.error(`${env.logPrefix} media message handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'media_failed',
        status: 'error',
        context: getEventContext(ctx, {error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.on('message', async (ctx) => {
    try {
      await handleCapturableMessage(ctx, ctx.message)
    } catch (error) {
      const identity = getUserIdentity(ctx)
      console.error(`${env.logPrefix} unsupported message handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'unsupported_failed',
        status: 'error',
        messageKind: 'unsupported',
        context: getEventContext(ctx, {error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.on('callback_query:data', async (ctx) => {
    const identity = getUserIdentity(ctx)
    const data = ctx.callbackQuery.data

    try {
      const result = await handleCallback({identity, data}, botDataClient)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'command',
        action: 'callback',
        status: isRejectedText(result.text) ? 'rejected' : 'ok',
        context: getEventContext(ctx, {reason: rejectedReason(result.text)}),
      })
      await ctx.answerCallbackQuery()
      await replyWithResult(ctx, result)
    } catch (error) {
      console.error(`${env.logPrefix} callback handler failed`, error)
      await safelyRecordBotEvent({
        ...getEventActor(identity),
        kind: 'error',
        action: 'callback_failed',
        status: 'error',
        context: getEventContext(ctx, {error, reason: 'handler_failed'}),
      })
      await safelyIncrementErrorCounter(ctx)
      await ctx.answerCallbackQuery()
      await reply(ctx, INTERNAL_ERROR_MESSAGE)
    }
  })

  bot.catch(async (error) => {
    console.error(`${env.logPrefix} unhandled grammY error`, error)
    const identity = getUserIdentity(error.ctx)
    await safelyRecordBotEvent({
      ...getEventActor(identity),
      kind: 'error',
      action: 'grammy_unhandled',
      status: 'error',
      context: getEventContext(error.ctx, {error: error.error, reason: 'grammy_unhandled'}),
    })
    await safelyIncrementErrorCounter(error.ctx)
    await reply(error.ctx, INTERNAL_ERROR_MESSAGE)
  })
}
