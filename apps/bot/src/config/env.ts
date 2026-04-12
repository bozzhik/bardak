function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`[bot] Missing required environment variable: ${name}`)
  }
  return value
}

type RuntimeLabel = 'dev' | 'prod'

function getRuntimeLabel(): RuntimeLabel {
  const value = process.env.BOT_RUNTIME?.trim()
  if (value === 'dev' || value === 'prod') return value
  throw new Error('[bot] Missing or invalid BOT_RUNTIME. Expected "dev" or "prod".')
}

const runtime = getRuntimeLabel()

export const env = {
  botToken: getRequiredEnv('TELEGRAM_BOT_TOKEN'),
  convexUrl: getRequiredEnv('NEXT_PUBLIC_CONVEX_URL'),
  runtime,
  logPrefix: `[bot:${runtime}]`,
} as const
