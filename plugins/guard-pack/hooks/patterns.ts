// Shared secret shapes, ported from claude-secret-guard-kit
// (hooks/secret-patterns.sh). Every guard rule reads them from here so the
// shapes stay in sync.

// Shapes of live credential VALUES. Spliced where the source text would
// otherwise match the shape it defines.
const SECRET_VALUE_SOURCES = [
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
  'gh[pousr]_[A-Za-z0-9]{30,}',
  'github_pat_[A-Za-z0-9_]{30,}',
  'sk-ant-[A-Za-z0-9_-]{20,}',
  'sk-(proj-)?[A-Za-z0-9_-]{32,}',
  'AIza[0-9A-Za-z_-]{30,}',
  'xox[baprs]-[A-Za-z0-9-]{10,}',
  'hooks\\.slack\\.com/services/T[A-Za-z0-9]+/B[A-Za-z0-9]+/[A-Za-z0-9]+',
  '[sr]k_live_[0-9a-zA-Z]{20,}',
  'eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
  '(postgres(ql)?|mysql|mongodb(\\+srv)?|redis|amqp|mssql)://[^:/@\\s]+:[^@\\s]+@',
  'npm_[A-Za-z0-9]{36}',
  'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}',
  'SK[0-9a-fA-F]{32}',
  'service_' + 'account.{0,120}private_' + 'key_id',
  'AccountKey=[A-Za-z0-9+/=]{60,}',
  'hf_[A-Za-z0-9]{30,}',
]

export const SECRET_VALUE = new RegExp(SECRET_VALUE_SOURCES.join('|'))

export const SECRET_VALUE_GLOBAL = new RegExp(SECRET_VALUE_SOURCES.join('|'), 'g')

// Secret-looking FILE names. Whole-ish tokens to keep false positives low.
export const SECRET_NAME =
  /\.env(\.[A-Za-z0-9_-]+)?|\.pem|\.key|\.p12|\.pfx|\.keystore|\.jks|id_rsa|id_dsa|id_ecdsa|id_ed25519|secrets?\.(json|ya?ml|txt)|credentials|\.pgpass|\.htpasswd|\.npmrc|\.netrc|serviceaccount.*\.json|\.p8/i

// Public env templates that must never trigger a prompt.
export const SECRET_NAME_SAFE = /\.env\.(example|sample|template|dist|md)/g

// Variable names whose values are secrets.
export const SECRET_VAR_NAMES = '(KEY|SECRET|TOKEN|PASSWORD|PASSWD|PASS|CREDENTIAL|PRIVATE)'

export const redact = (text: string): string => text.replace(SECRET_VALUE_GLOBAL, '[REDACTED]')
