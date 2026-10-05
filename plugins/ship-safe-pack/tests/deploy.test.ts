import { expect, test } from 'claude-code/testing'

import { deploysIn } from '../hooks/rules/deploy'
import { probe } from './probe'

const HITS: ReadonlyArray<readonly [string, string]> = [
  ['vercel --prod', 'vercel --prod'],
  ['vercel deploy --prod --yes', 'vercel --prod'],
  ['npx vercel --prod', 'vercel --prod'],
  ['vercel deploy --target=production', 'vercel --prod'],
  ['vercel deploy --target production', 'vercel --prod'],
  ['netlify deploy --prod', 'netlify deploy --prod'],
  ['netlify deploy --dir dist --prod-if-unlocked', 'netlify deploy --prod'],
  ['firebase deploy', 'firebase deploy'],
  ['firebase deploy --only functions', 'firebase deploy'],
  ['firebase deploy --only hosting', 'firebase deploy'],
  ['firebase --project prod deploy --only hosting:main', 'firebase deploy'],
  ['npx firebase-tools deploy', 'firebase deploy'],
  ['fly deploy', 'fly deploy'],
  ['flyctl deploy --app shop', 'fly deploy'],
  ['gcloud app deploy', 'gcloud app deploy'],
  ['gcloud --project shop-prod app deploy app.yaml', 'gcloud app deploy'],
  ['eb deploy shop-prod', 'eb deploy'],
  ['heroku releases:rollback v41 -a shop', 'heroku releases:rollback'],
  ['heroku rollback -a shop', 'heroku releases:rollback'],
  ['serverless deploy --stage prod', 'serverless deploy --stage prod'],
  ['sls deploy -s production', 'serverless deploy --stage prod'],
  ['npx serverless deploy --stage=prod', 'serverless deploy --stage prod'],
  ['npm run build && vercel --prod', 'vercel --prod'],
]
const MISSES = [
  'vercel',
  'vercel deploy',
  'vercel dev',
  'vercel env pull',
  'netlify deploy',
  'netlify deploy --dir dist',
  'netlify dev',
  'firebase deploy --dry-run',
  'firebase deploy --only hosting:preview',
  'firebase hosting:channel:deploy pr-42',
  'firebase emulators:start',
  'fly deploy --build-only',
  'fly status',
  'gcloud app browse',
  'gcloud run services list',
  'eb status',
  'heroku releases -a shop',
  'heroku logs --tail',
  'serverless deploy',
  'serverless deploy --stage dev',
  'sls deploy -s staging',
  'echo "vercel --prod"',
  'grep "firebase deploy" README.md',
]

test('deploy-guard: command table', () => {
  for (const [command, name] of HITS) expect({ command, found: deploysIn(command) }).toEqual({ command, found: [name] })
  for (const command of MISSES) expect({ command, found: deploysIn(command) }).toEqual({ command, found: [] })
})

test('deploy-guard: asks through the engine and passes the traps', async ($, on) => {
  const guard = probe($, on)
  for (const [command] of HITS) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: true })
  for (const command of MISSES) expect({ command, answered: await guard.answered(command) }).toEqual({ command, answered: false })
})
