import type { PushTools } from './engine'

// Shared by the chat webhook rules. The webhook URL is the secret: it never
// appears in an error the engine logs, even when the network layer quotes it.
const scrub = (message: string, url: string): string => message.split(url).join('[webhook URL]')

export const postJson = async (tools: PushTools, url: string, payload: Readonly<Record<string, unknown>>): Promise<void> => {
  try {
    await tools.post(url, { 'Content-Type': 'application/json' }, JSON.stringify(payload))
  } catch (error) {
    throw new Error(scrub(error instanceof Error ? error.message : String(error), url))
  }
}
