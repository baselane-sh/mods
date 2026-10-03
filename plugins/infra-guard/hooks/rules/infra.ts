import type { GuardRule } from '../engine'

// Confirmation gate for destructive infra, git and database commands.
const DANGERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/terraform +(destroy|apply)/, 'terraform destroy or apply'],
  [/kubectl +delete/, 'kubectl delete'],
  [/aws +[a-z0-9-]+ +(delete|terminate|remove)[a-z-]*/, 'aws delete or terminate'],
  [/git +push +.*(--force|-f)( |$)/m, 'git force-push'],
  [/drop +(table|database|schema)/i, 'SQL DROP'],
]
const RM_RF = /(^|[;&|] *)rm +(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)/m
// rm -rf inside tmp, the scratchpad or node_modules stays silent.
const RM_SAFE = /rm +-[a-zA-Z]+ +("|')?(\/private)?\/tmp\/|node_modules/

export const dangersIn = (command: string): readonly string[] => [
  ...DANGERS.filter(([pattern]) => pattern.test(command)).map(([, name]) => name),
  ...(RM_RF.test(command) && !RM_SAFE.test(command) ? ['rm -rf'] : []),
]

export const rule: GuardRule = {
  id: 'infra-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = dangersIn(e.command)
    return found.length === 0 ? undefined : `destructive command detected (${found.join(', ')}).`
  },
}
