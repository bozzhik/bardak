export type NormalizedTextMessage =
  | {
      kind: 'command'
      command: string
    }
  | {
      kind: 'text'
      text: string
    }

export function normalizeTextMessage(text: string): NormalizedTextMessage {
  if (text.startsWith('/')) {
    return {
      kind: 'command',
      command: text.split(/\s+/, 1)[0] ?? text,
    }
  }

  return {
    kind: 'text',
    text,
  }
}
