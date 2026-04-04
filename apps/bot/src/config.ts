const readRequiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const TELEGRAM_BOT_TOKEN = readRequiredEnv('TELEGRAM_BOT_TOKEN')
export const NEXT_PUBLIC_CONVEX_URL = readRequiredEnv('NEXT_PUBLIC_CONVEX_URL')
