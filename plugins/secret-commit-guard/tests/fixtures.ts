// Fake credential values, spliced so this file does not match the shapes it
// carries (the same trick as the kit's tests/lib.sh).
export const FAKE = {
  aws: 'AKIA' + 'ABCDEFGHIJKLMNOP',
  github: 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789',
  anthropic: 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz',
  openai: 'sk-proj-' + 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
  stripe: 'sk_live_' + '4eC39HqLyjWDarjtT1zdp7dc',
  postgres: 'postgres:' + '//app:S3cretPass@db.example.com:5432/prod',
  npm: 'npm_' + 'abcdefghijklmnopqrstuvwxyz0123456789',
  gcp: '{"type": "service_' + 'account", "private_key_id": "abc"}',
  pem: '-----BEGIN RSA PRIVATE ' + 'KEY-----',
} as const

// Tools for calling a rule's check directly, outside any repo.
export const NO_TOOLS = {
  cwd: async () => '/nowhere',
  realPath: async () => undefined,
  run: async () => ({ exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }),
}
