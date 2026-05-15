import type {BotDataClient} from '@/bot/flow'
import type {CompleteTagFlowArgs, CompleteTagFlowResult, ListTagsArgs, ListTagsResult, RegisterOnStartArgs, RegisterOnStartResult, SaveEntryArgs, SaveEntryResult, TouchOnCommandResult, TouchOnTextResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

type FakeBotDataClientOptions = {
  registerResult?: RegisterOnStartResult
  touchResult?: TouchOnTextResult
  touchCommandResult?: TouchOnCommandResult
  listTagsResult?: ListTagsResult
  saveEntryResult?: SaveEntryResult
  upsertFlowResult?: UpsertFlowResult
  completeTagFlowResult?: CompleteTagFlowResult
}

export type FakeBotDataClient = BotDataClient & {
  registerCalls: RegisterOnStartArgs[]
  touchCalls: UserIdentityPayload[]
  touchCommandCalls: UserIdentityPayload[]
  listTagsCalls: ListTagsArgs[]
  completeTagFlowCalls: CompleteTagFlowArgs[]
  saveEntryCalls: SaveEntryArgs[]
  upsertFlowCalls: UpsertFlowArgs[]
}

export function createFakeBotDataClient(options: FakeBotDataClientOptions = {}): FakeBotDataClient {
  const registerCalls: RegisterOnStartArgs[] = []
  const touchCalls: UserIdentityPayload[] = []
  const touchCommandCalls: UserIdentityPayload[] = []
  const listTagsCalls: ListTagsArgs[] = []
  const completeTagFlowCalls: CompleteTagFlowArgs[] = []
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

  return {
    registerCalls,
    touchCalls,
    touchCommandCalls,
    listTagsCalls,
    completeTagFlowCalls,
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
    async completeTagFlow(args) {
      completeTagFlowCalls.push(args)
      return completeTagFlowResult
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
