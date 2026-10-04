import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// Kubernetes and Helm calls that take workloads down or replace them in
// place. Reads, plain apply and cordon pass.
//
// infra-guard already asks when the text holds `kubectl delete`, so this rule
// leaves those commands to it (one dialog, not two) and catches only the
// delete it misses: global flags between kubectl and delete
// (`kubectl -n prod delete`).
const INFRA_KUBECTL_DELETE = /kubectl +delete/
const KUBECTL_VALUE_FLAGS = new Set(['-n', '--namespace', '--context', '--kubeconfig', '-s', '--server', '--cluster', '--user', '--token', '--as', '--as-group', '--request-timeout', '-v'])
const HELM_VALUE_FLAGS = new Set(['-n', '--namespace', '--kube-context', '--kubeconfig', '--kube-apiserver', '--kube-token', '--registry-config', '--repository-config', '--repository-cache'])
const HELM_UNINSTALL = new Set(['uninstall', 'delete', 'del', 'un'])
const FORCED = new Set(['apply', 'replace'])

const isForce = (word: string): boolean => word === '--force' || word === '--force=true'

const kubectlDanger = (argv: readonly string[], command: string): string[] => {
  const { sub, args } = subcommandOf(argv, KUBECTL_VALUE_FLAGS)
  if (sub === 'delete') return INFRA_KUBECTL_DELETE.test(command) ? [] : ['kubectl delete']
  if (sub === 'drain') return ['kubectl drain']
  return sub !== undefined && FORCED.has(sub) && args.some(isForce) ? [`kubectl ${sub} --force`] : []
}

const helmDanger = (argv: readonly string[]): string[] => {
  const { sub } = subcommandOf(argv, HELM_VALUE_FLAGS)
  return sub !== undefined && HELM_UNINSTALL.has(sub) ? ['helm uninstall'] : []
}

export const k8sDangersIn = (command: string): readonly string[] => {
  const found = commandsOf(command).flatMap(argv => {
    const name = argv[0] === undefined ? undefined : base(argv[0])
    if (name === 'kubectl') return kubectlDanger(argv, command)
    return name === 'helm' ? helmDanger(argv) : []
  })
  return [...new Set(found)]
}

export const rule: GuardRule = {
  id: 'k8s-guard',
  decision: 'ask',
  check: e => {
    if (e.tool !== 'Bash') return undefined
    const found = k8sDangersIn(e.command)
    return found.length === 0 ? undefined : `this takes Kubernetes workloads down or replaces them in place (${found.join(', ')}).`
  },
}
