import type { GuardRule } from '../engine'
import { base, commandsOf, subcommandOf } from '../shell'

// Kubernetes and Helm calls that take workloads down or replace them in
// place. Reads, plain apply and cordon pass.
//
// infra-guard already asks for a plain `kubectl delete`, so this rule leaves
// that command to it (one dialog, not two) and catches only the delete it
// misses: global flags between kubectl and delete (`kubectl -n prod delete`).
// The test is per command, so a plain delete elsewhere in the line does not
// hide a flagged one.
const KUBECTL_VALUE_FLAGS = new Set([
  '-n', '--namespace', '--context', '--kubeconfig', '-s', '--server', '--cluster', '--user', '--token', '--as', '--as-group', '--as-uid',
  '--request-timeout', '-v', '--v', '--vmodule', '--cache-dir', '--certificate-authority', '--client-certificate', '--client-key',
  '--username', '--password', '--tls-server-name', '--profile', '--profile-output', '--log-flush-frequency',
])
const HELM_VALUE_FLAGS = new Set(['-n', '--namespace', '--kube-context', '--kubeconfig', '--kube-apiserver', '--kube-token', '--registry-config', '--repository-config', '--repository-cache'])
const HELM_UNINSTALL = new Set(['uninstall', 'delete', 'del', 'un'])
const FORCED = new Set(['apply', 'replace'])

const isForce = (word: string): boolean => word === '--force' || word === '--force=true'

const kubectlDanger = (argv: readonly string[]): string[] => {
  const { globals, sub, args } = subcommandOf(argv, KUBECTL_VALUE_FLAGS)
  if (sub === 'delete') return globals.length === 0 ? [] : ['kubectl delete']
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
    if (name === 'kubectl') return kubectlDanger(argv)
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
