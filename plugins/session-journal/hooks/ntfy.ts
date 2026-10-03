import type { PushTools } from './engine'

// Shared by the two ntfy rules. Only a generic message and the project
// directory name ever leave the machine.
export const projectName = (cwd: string): string => cwd.split('/').filter(part => part !== '').pop() ?? 'session'

export const ntfyPush = (tools: PushTools, topic: string, message: string): Promise<void> =>
  tools.post(`https://ntfy.sh/${encodeURIComponent(topic)}`, { Title: 'Claude Code' }, message)
