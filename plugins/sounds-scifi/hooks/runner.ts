// Test runners count only in command position, so `cat jest.config.js` or
// `grep vitest` never count as a test run. Copied from the nudge engine's
// test-reminder rule: a mod may import only its own files.
const START = '(^|[;&|] *)((npx|bunx|pnpm exec|yarn|uv run|poetry run|bundle exec) +)?'
const RUNNERS =
  '((npm|pnpm|yarn|bun) +(run +)?test|vitest|jest|mocha|pytest|python3? +-m +(pytest|unittest)|go +test|cargo +test|rspec|phpunit|mvn +(test|verify)|gradle +test|dotnet +test|ctest|make +(test|check)|bash +tests?/run\\.sh|tests?/run\\.sh|claude +plugin +test)'
export const TEST_RUNNER = new RegExp(`${START}${RUNNERS}( |$)`, 'm')
