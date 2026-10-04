import { expect, test } from 'claude-code/testing'

import { k8sDangersIn } from '../hooks/rules/k8s'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['kubectl -n prod delete pod web-1', 'kubectl delete'],
  ['kubectl --namespace prod delete deploy api', 'kubectl delete'],
  ['kubectl --context=prod delete ns shop', 'kubectl delete'],
  ['kubectl apply --force -f deploy.yaml', 'kubectl apply --force'],
  ['kubectl apply -f deploy.yaml --force=true', 'kubectl apply --force'],
  ['kubectl replace --force -f pod.yaml', 'kubectl replace --force'],
  ['kubectl drain node-1 --ignore-daemonsets', 'kubectl drain'],
  ['kubectl --context prod drain node-1', 'kubectl drain'],
  ['sudo kubectl drain node-1', 'kubectl drain'],
  ['cd k8s && kubectl apply --force -f .', 'kubectl apply --force'],
  ['helm uninstall shop', 'helm uninstall'],
  ['helm -n prod uninstall shop', 'helm uninstall'],
  ['helm --kube-context prod uninstall shop', 'helm uninstall'],
  ['helm delete shop', 'helm uninstall'],
  ['helm del shop', 'helm uninstall'],
  ['helm un shop --keep-history', 'helm uninstall'],
  ['helm list | grep old; helm uninstall old', 'helm uninstall'],
  ['bash -c "helm uninstall shop"', 'helm uninstall'],
]
const MISSES = [
  'kubectl get pods',
  'kubectl -n prod get pods',
  'kubectl describe pod web-1',
  'kubectl logs -f web-1',
  'kubectl apply -f deploy.yaml',
  'kubectl apply --server-side --force-conflicts -f deploy.yaml',
  'kubectl apply --force=false -f deploy.yaml',
  'kubectl cordon node-1',
  'kubectl uncordon node-1',
  'helm list',
  'helm -n prod status shop',
  'helm upgrade --install shop ./chart',
  'echo "kubectl drain node-1"',
  'grep "helm uninstall" README.md',
  // infra-guard asks for these, so this rule stays silent: one dialog, not two.
  'kubectl delete pod web-1',
  'sudo kubectl delete ns shop',
]

test('k8s-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: k8sDangersIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: k8sDangersIn(command) }).toEqual({ command, found: [] })
})

test('k8s-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
