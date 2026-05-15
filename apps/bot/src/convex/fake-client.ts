import type {BotDataClient} from '@/bot/flow'
import type {RegisterOnStartArgs, RegisterOnStartResult, TouchOnTextResult, UserIdentityPayload} from '@/convex/functions'

type FakeBotDataClientOptions = {
  registerResult?: RegisterOnStartResult
  touchResult?: TouchOnTextResult
}

export type FakeBotDataClient = BotDataClient & {
  registerCalls: RegisterOnStartArgs[]
  touchCalls: UserIdentityPayload[]
}

export function createFakeBotDataClient(options: FakeBotDataClientOptions = {}): FakeBotDataClient {
  const registerCalls: RegisterOnStartArgs[] = []
  const touchCalls: UserIdentityPayload[] = []
  const registerResult = options.registerResult ?? {
    status: 'updated',
    userId: 'users:test',
  }
  const touchResult = options.touchResult ?? {
    status: 'updated',
    userId: 'users:test',
  }

  return {
    registerCalls,
    touchCalls,
    async registerOnStart(args) {
      registerCalls.push(args)
      return registerResult
    },
    async touchOnText(args) {
      touchCalls.push(args)
      return touchResult
    },
  }
}
