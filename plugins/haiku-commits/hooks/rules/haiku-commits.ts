import type { StyleRule } from '../engine'

// The conventional line stays first and plain: git log, changelog tools and
// commit linters read only that line. The haiku goes in the body.
export const rule: StyleRule = {
  id: 'haiku-commits',
  section:
    'Style: haiku commits. Write every commit message in two parts. The first line is a normal Conventional Commits subject, type(scope): subject, in the imperative and under 72 characters, so tools still parse it. Then a blank line, then the body as one haiku of three lines: five syllables, seven syllables, five syllables (5-7-5), about the change. Count the syllables: the haiku is a five, a seven and a five, not prose cut into three lines. Never put the haiku on the first line, and never replace the subject with it. This applies only to commit messages (and squash or merge messages). Everything else you write, including pull request text, code and comments, stays normal.',
}
