// A guess at "this Bash command ran a test suite": some segment of the line
// starts with a known runner. Quoted text is dropped first, so a commit
// message that names jest does not count.
const RUNNER = new RegExp(
  '^(?:\\w+=\\S+\\s+)*(?:(?:npx|pnpm exec|pnpm dlx|yarn|uv run|poetry run|python3? -m|bunx)\\s+)?' +
    '(?:(?:npm|pnpm|yarn|bun)\\s+(?:run\\s+)?test|vitest|jest|pytest|mocha|rspec|phpunit|ctest|' +
    '(?:go|cargo|dotnet|swift|deno|mvn|gradle|make)\\s+test|cargo\\s+nextest|(?:npx\\s+)?playwright\\s+test)\\b',
)

const unquoted = (command: string): string => command.replace(/"[^"]*"|'[^']*'/g, '""')

export const isTestCommand = (command: string): boolean =>
  unquoted(command)
    .split(/&&|\|\||;|\||\n/)
    .some(segment => RUNNER.test(segment.trim()))
