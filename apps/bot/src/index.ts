import {Elysia} from 'elysia'

import {initBot} from '@/bot/init'
import {env} from '@/config/env'
import {botCommands} from '@/bot/commands'

const bot = initBot()

const app = new Elysia()
  .get('/', () => ({
    service: 'bardak-bot', // service-name
    ok: true,
  }))
  .get('/health', () => ({
    service: 'bardak-bot',
    ok: true,
    timestamp: new Date().toISOString(),
  }))

async function startRuntime(): Promise<void> {
  await bot.api.setMyCommands(botCommands)
  bot.start({
    allowed_updates: ['message'],
    onStart: () => {
      console.log(`${env.logPrefix} long polling started`)
    },
  })

  app.listen(2000, () => {
    console.log(`${env.logPrefix} http server started on :2000`)
  })
}

async function shutdown(signal: string): Promise<void> {
  console.log(`${env.logPrefix} ${signal} received, shutting down`)
  bot.stop()
  await app.stop()
  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void shutdown(signal)
  })
}

void startRuntime()
