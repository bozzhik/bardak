import type {BotDataClient} from '@/bot/flow'
import type {CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult, CompleteTagFlowArgs, CompleteTagFlowResult, EnsureTagArgs, EnsureTagResult, FindTagArgs, FindTagResult, ListTagsArgs, ListTagsResult, RegisterOnStartArgs, RegisterOnStartResult, RemoveTagArgs, RemoveTagResult, RenameTagArgs, RenameTagResult, SaveEntryArgs, SaveEntryResult, TouchOnCommandResult, TouchOnTextResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

type FakeBotDataClientOptions = {
  registerResult?: RegisterOnStartResult
  touchResult?: TouchOnTextResult
  touchCommandResult?: TouchOnCommandResult
  listTagsResult?: ListTagsResult
  ensureTagResult?: EnsureTagResult
  renameTagResult?: RenameTagResult
  findTagResult?: FindTagResult
  removeTagResult?: RemoveTagResult
  saveEntryResult?: SaveEntryResult
  upsertFlowResult?: UpsertFlowResult
  completeTagFlowResult?: CompleteTagFlowResult
  completeTagFlowByIdResult?: CompleteTagFlowByIdResult
}

export type FakeBotDataClient = BotDataClient & {
  registerCalls: RegisterOnStartArgs[]
  touchCalls: UserIdentityPayload[]
  touchCommandCalls: UserIdentityPayload[]
  listTagsCalls: ListTagsArgs[]
  ensureTagCalls: EnsureTagArgs[]
  renameTagCalls: RenameTagArgs[]
  findTagCalls: FindTagArgs[]
  removeTagCalls: RemoveTagArgs[]
  completeTagFlowCalls: CompleteTagFlowArgs[]
  completeTagFlowByIdCalls: CompleteTagFlowByIdArgs[]
  saveEntryCalls: SaveEntryArgs[]
  upsertFlowCalls: UpsertFlowArgs[]
}

export function createFakeBotDataClient(options: FakeBotDataClientOptions = {}): FakeBotDataClient {
  const registerCalls: RegisterOnStartArgs[] = []
  const touchCalls: UserIdentityPayload[] = []
  const touchCommandCalls: UserIdentityPayload[] = []
  const listTagsCalls: ListTagsArgs[] = []
  const ensureTagCalls: EnsureTagArgs[] = []
  const renameTagCalls: RenameTagArgs[] = []
  const findTagCalls: FindTagArgs[] = []
  const removeTagCalls: RemoveTagArgs[] = []
  const completeTagFlowCalls: CompleteTagFlowArgs[] = []
  const completeTagFlowByIdCalls: CompleteTagFlowByIdArgs[] = []
  const saveEntryCalls: SaveEntryArgs[] = []
  const upsertFlowCalls: UpsertFlowArgs[] = []
  const registerResult = options.registerResult ?? {
    status: 'updated',
    userId: 'users:test',
  }
  const touchResult = options.touchResult ?? {
    status: 'updated',
    userId: 'users:test',
  }
  const touchCommandResult = options.touchCommandResult ?? {
    status: 'updated',
    userId: 'users:test',
  }
  const listTagsResult = options.listTagsResult ?? []
  const ensureTagResult = options.ensureTagResult ?? {
    status: 'created',
    tagId: 'tags:test',
  }
  const renameTagResult = options.renameTagResult ?? {
    status: 'renamed',
    tagId: 'tags:test',
    name: 'home',
    slug: 'home',
  }
  const findTagResult = options.findTagResult ?? {
    status: 'missing',
  }
  const removeTagResult = options.removeTagResult ?? {
    status: 'deleted',
    tagName: 'work',
    linkCount: 0,
  }
  const saveEntryResult = options.saveEntryResult ?? {
    status: 'created',
    entryId: 'entries:test',
    entryStatus: 'inbox',
    tagIds: [],
  }
  const upsertFlowResult = options.upsertFlowResult ?? {
    status: 'created',
    flowId: 'flows:test',
  }
  const completeTagFlowResult = options.completeTagFlowResult ?? {
    status: 'no_active',
  }
  const completeTagFlowByIdResult = options.completeTagFlowByIdResult ?? {
    status: 'no_active',
  }

  return {
    registerCalls,
    touchCalls,
    touchCommandCalls,
    listTagsCalls,
    ensureTagCalls,
    renameTagCalls,
    findTagCalls,
    removeTagCalls,
    completeTagFlowCalls,
    completeTagFlowByIdCalls,
    saveEntryCalls,
    upsertFlowCalls,
    async registerOnStart(args) {
      registerCalls.push(args)
      return registerResult
    },
    async touchOnText(args) {
      touchCalls.push(args)
      return touchResult
    },
    async touchOnCommand(args) {
      touchCommandCalls.push(args)
      return touchCommandResult
    },
    async listTags(args) {
      listTagsCalls.push(args)
      return listTagsResult
    },
    async ensureTag(args) {
      ensureTagCalls.push(args)
      return ensureTagResult
    },
    async renameTag(args) {
      renameTagCalls.push(args)
      return renameTagResult
    },
    async findTag(args) {
      findTagCalls.push(args)
      return findTagResult
    },
    async removeTag(args) {
      removeTagCalls.push(args)
      return removeTagResult
    },
    async completeTagFlow(args) {
      completeTagFlowCalls.push(args)
      return completeTagFlowResult
    },
    async completeTagFlowById(args) {
      completeTagFlowByIdCalls.push(args)
      return completeTagFlowByIdResult
    },
    async saveEntry(args) {
      saveEntryCalls.push(args)
      return args.tags.length > 0 ? {...saveEntryResult, entryStatus: 'saved', tagIds: ['tags:test']} : saveEntryResult
    },
    async upsertFlow(args) {
      upsertFlowCalls.push(args)
      return upsertFlowResult
    },
  }
}
