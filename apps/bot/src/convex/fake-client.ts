import type {BotDataClient} from '@/bot/flow'
import type {ArchiveEntryBySourceMessageArgs, ArchiveEntryBySourceMessageResult, CancelTagFlowArgs, CancelTagFlowResult, CompleteDescriptionFlowArgs, CompleteDescriptionFlowResult, CompleteTagFlowByIdArgs, CompleteTagFlowByIdResult, CompleteTagFlowArgs, CompleteTagFlowResult, CountInboxArgs, CountInboxResult, EnsureTagArgs, EnsureTagResult, FindTagArgs, FindTagResult, GetActiveFlowArgs, GetActiveFlowResult, ListTagsArgs, ListTagsResult, NextInboxArgs, NextInboxResult, RegisterOnStartArgs, RegisterOnStartResult, RemoveTagArgs, RemoveTagResult, RenameTagArgs, RenameTagResult, SaveEntryArgs, SaveEntryResult, SearchEntriesArgs, SearchEntriesResult, TouchOnCommandResult, TouchOnTextResult, UpdateEntryFromEditArgs, UpdateEntryFromEditResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

type FakeBotDataClientOptions = {
  registerResult?: RegisterOnStartResult
  touchResult?: TouchOnTextResult
  touchCommandResult?: TouchOnCommandResult
  listTagsResult?: ListTagsResult
  countInboxResult?: CountInboxResult
  nextInboxResult?: NextInboxResult
  searchEntriesResult?: SearchEntriesResult
  ensureTagResult?: EnsureTagResult
  renameTagResult?: RenameTagResult
  findTagResult?: FindTagResult
  removeTagResult?: RemoveTagResult
  saveEntryResult?: SaveEntryResult
  updateEntryFromEditResult?: UpdateEntryFromEditResult
  archiveEntryBySourceMessageResult?: ArchiveEntryBySourceMessageResult
  upsertFlowResult?: UpsertFlowResult
  activeFlowResult?: GetActiveFlowResult
  completeTagFlowResult?: CompleteTagFlowResult
  completeTagFlowByIdResult?: CompleteTagFlowByIdResult
  completeDescriptionFlowResult?: CompleteDescriptionFlowResult
  cancelTagFlowResult?: CancelTagFlowResult
}

export type FakeBotDataClient = BotDataClient & {
  registerCalls: RegisterOnStartArgs[]
  touchCalls: UserIdentityPayload[]
  touchCommandCalls: UserIdentityPayload[]
  listTagsCalls: ListTagsArgs[]
  countInboxCalls: CountInboxArgs[]
  nextInboxCalls: NextInboxArgs[]
  searchEntriesCalls: SearchEntriesArgs[]
  ensureTagCalls: EnsureTagArgs[]
  renameTagCalls: RenameTagArgs[]
  findTagCalls: FindTagArgs[]
  removeTagCalls: RemoveTagArgs[]
  completeTagFlowCalls: CompleteTagFlowArgs[]
  completeTagFlowByIdCalls: CompleteTagFlowByIdArgs[]
  completeDescriptionFlowCalls: CompleteDescriptionFlowArgs[]
  cancelTagFlowCalls: CancelTagFlowArgs[]
  saveEntryCalls: SaveEntryArgs[]
  updateEntryFromEditCalls: UpdateEntryFromEditArgs[]
  archiveEntryBySourceMessageCalls: ArchiveEntryBySourceMessageArgs[]
  upsertFlowCalls: UpsertFlowArgs[]
  activeFlowCalls: GetActiveFlowArgs[]
}

export function createFakeBotDataClient(options: FakeBotDataClientOptions = {}): FakeBotDataClient {
  const registerCalls: RegisterOnStartArgs[] = []
  const touchCalls: UserIdentityPayload[] = []
  const touchCommandCalls: UserIdentityPayload[] = []
  const listTagsCalls: ListTagsArgs[] = []
  const countInboxCalls: CountInboxArgs[] = []
  const nextInboxCalls: NextInboxArgs[] = []
  const searchEntriesCalls: SearchEntriesArgs[] = []
  const ensureTagCalls: EnsureTagArgs[] = []
  const renameTagCalls: RenameTagArgs[] = []
  const findTagCalls: FindTagArgs[] = []
  const removeTagCalls: RemoveTagArgs[] = []
  const completeTagFlowCalls: CompleteTagFlowArgs[] = []
  const completeTagFlowByIdCalls: CompleteTagFlowByIdArgs[] = []
  const completeDescriptionFlowCalls: CompleteDescriptionFlowArgs[] = []
  const cancelTagFlowCalls: CancelTagFlowArgs[] = []
  const saveEntryCalls: SaveEntryArgs[] = []
  const updateEntryFromEditCalls: UpdateEntryFromEditArgs[] = []
  const archiveEntryBySourceMessageCalls: ArchiveEntryBySourceMessageArgs[] = []
  const upsertFlowCalls: UpsertFlowArgs[] = []
  const activeFlowCalls: GetActiveFlowArgs[] = []
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
  const countInboxResult = options.countInboxResult ?? {
    count: 0,
    isTruncated: false,
  }
  const nextInboxResult = options.nextInboxResult ?? {
    status: 'empty',
  }
  const searchEntriesResult = options.searchEntriesResult ?? {
    items: [],
    isTruncated: false,
  }
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
  const updateEntryFromEditResult = options.updateEntryFromEditResult ?? {
    status: 'updated',
    entryId: 'entries:test',
    entryStatus: 'inbox',
    tagIds: [],
  }
  const archiveEntryBySourceMessageResult = options.archiveEntryBySourceMessageResult ?? {
    status: 'archived',
    entryId: 'entries:test',
  }
  const upsertFlowResult = options.upsertFlowResult ?? {
    status: 'created',
    flowId: 'flows:test',
  }
  const activeFlowResult = options.activeFlowResult ?? {
    status: 'none',
  }
  const completeTagFlowResult = options.completeTagFlowResult ?? {
    status: 'no_active',
  }
  const completeTagFlowByIdResult = options.completeTagFlowByIdResult ?? {
    status: 'no_active',
  }
  const completeDescriptionFlowResult = options.completeDescriptionFlowResult ?? {
    status: 'no_active',
  }
  const cancelTagFlowResult = options.cancelTagFlowResult ?? {
    status: 'no_active',
  }

  return {
    registerCalls,
    touchCalls,
    touchCommandCalls,
    listTagsCalls,
    countInboxCalls,
    nextInboxCalls,
    searchEntriesCalls,
    ensureTagCalls,
    renameTagCalls,
    findTagCalls,
    removeTagCalls,
    completeTagFlowCalls,
    completeTagFlowByIdCalls,
    completeDescriptionFlowCalls,
    cancelTagFlowCalls,
    saveEntryCalls,
    updateEntryFromEditCalls,
    archiveEntryBySourceMessageCalls,
    upsertFlowCalls,
    activeFlowCalls,
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
    async countInbox(args) {
      countInboxCalls.push(args)
      return countInboxResult
    },
    async getNextInbox(args) {
      nextInboxCalls.push(args)
      return nextInboxResult
    },
    async searchEntries(args) {
      searchEntriesCalls.push(args)
      return searchEntriesResult
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
    async completeDescriptionFlow(args) {
      completeDescriptionFlowCalls.push(args)
      return completeDescriptionFlowResult
    },
    async cancelTagFlow(args) {
      cancelTagFlowCalls.push(args)
      return cancelTagFlowResult
    },
    async saveEntry(args) {
      saveEntryCalls.push(args)
      return args.tags.length > 0 ? {...saveEntryResult, entryStatus: 'saved', tagIds: ['tags:test']} : saveEntryResult
    },
    async updateEntryFromEdit(args) {
      updateEntryFromEditCalls.push(args)
      return args.tags.length > 0 && updateEntryFromEditResult.status === 'updated' ? {...updateEntryFromEditResult, entryStatus: 'saved', tagIds: ['tags:test']} : updateEntryFromEditResult
    },
    async archiveEntryBySourceMessage(args) {
      archiveEntryBySourceMessageCalls.push(args)
      return archiveEntryBySourceMessageResult
    },
    async upsertFlow(args) {
      upsertFlowCalls.push(args)
      return upsertFlowResult
    },
    async getActiveFlow(args) {
      activeFlowCalls.push(args)
      return activeFlowResult
    },
  }
}
