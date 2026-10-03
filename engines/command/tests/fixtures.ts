// Fake credential values, spliced so this file does not match the shapes it
// carries (the same trick as the guard engine's fixtures).
export const FAKE = {
  github: 'ghp_' + 'abcdefghijklmnopqrstuvwxyz0123456789',
  anthropic: 'sk-ant-' + 'api03-abcdefghijklmnopqrstuvwxyz',
  postgres: 'postgres:' + '//app:S3cretPass@db.example.com:5432/prod',
} as const
