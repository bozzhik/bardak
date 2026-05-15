import type {BotDataClient} from '@/bot/flow'
import type {RegisterOnStartArgs, RegisterOnStartResult, SaveEntryArgs, SaveEntryResult, TouchOnTextResult, UpsertFlowArgs, UpsertFlowResult, UserIdentityPayload} from '@/convex/functions'

type FakeBotDataClientOptions = {
  registerResult?: RegisterOnStartResult
  touchResult?: TouchOnTextResult
  saveEntryResult?: SaveEntryResult
  upsertFlowResult?: UpsertFlowResult
}

export type FakeBotDataClient = BotDataClient & {
  registerCalls: RegisterOnStartArgs[]
  touchCalls: UserIdentityPayload[]
  saveEntryCalls: SaveEntryArgs[]
  upsertFlowCalls: UpsertFlowArgs[]
}

export function createFakeBotDataClient(options: FakeBotDataClientOptions = {}): FakeBotDataClient {
  const registerCalls: RegisterOnStartArgs[] = []
  const touchCalls: UserIdentityPayload[] = []
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

  return {
    registerCalls,
    touchCalls,
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
