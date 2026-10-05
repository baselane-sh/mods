import { expect, test } from 'claude-code/testing'

import { registryPushesIn } from '../hooks/rules/registry-push'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['docker push acme/api:1.2.0', 'docker push'],
  ['docker image push ghcr.io/acme/api:latest', 'docker push'],
  ['docker --context prod push acme/api', 'docker push'],
  ['docker push --all-tags acme/api', 'docker push'],
  ['docker buildx build --push -t acme/api .', 'docker buildx --push'],
  ['docker buildx build -t acme/api --platform linux/amd64,linux/arm64 --push .', 'docker buildx --push'],
  ['docker build --push -t acme/api .', 'docker buildx --push'],
  ['docker manifest push acme/api:1.2.0', 'docker manifest push'],
  ['podman push acme/api:1.2.0', 'podman push'],
  ['podman image push quay.io/acme/api', 'podman push'],
  ['helm push chart-1.0.0.tgz oci://ghcr.io/acme/charts', 'helm push'],
  ['gcloud artifacts docker push us-docker.pkg.dev/p/r/api', 'gcloud artifacts docker push'],
  ['sudo docker push acme/api', 'docker push'],
  ['docker build -t acme/api . && docker push acme/api', 'docker push'],
]
const MISSES = [
  'docker pull acme/api:1.2.0',
  'docker build -t acme/api .',
  'docker buildx build -t acme/api --load .',
  'docker images',
  'docker push localhost:5000/api',
  'docker push 127.0.0.1:5000/api:dev',
  'podman pull acme/api',
  'helm package ./chart',
  'helm push chart.tgz oci://localhost:5000/charts',
  'helm install shop ./chart',
  'gcloud artifacts docker images list us-docker.pkg.dev/p/r',
  'echo "docker push acme/api"',
  'git push origin main',
]

test('registry-push-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: registryPushesIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: registryPushesIn(command) }).toEqual({ command, found: [] })
})

test('registry-push-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
