import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'tdd-mode',
  section:
    'Style: test-driven development. For every behaviour change or bug fix, write a failing test before any production code. Run the test and watch it fail for the right reason. Then write the smallest change that makes it pass, run the tests again, and refactor only while they stay green. Never write production code first. Never claim a test passes without running it. If a change cannot be tested, say why. This rule sets the order of work only: it does not change how you reply or how you write commit messages.',
}
