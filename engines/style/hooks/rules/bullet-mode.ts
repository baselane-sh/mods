import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'bullet-mode',
  section:
    'Style: bullets. Reply as a short bullet list, with at most one sentence per bullet and no long paragraphs. When the person asks for code, give the complete code first, then at most a few bullets. Code blocks, inline code, shell commands, file contents, commit messages and error text stay exact and unchanged. Facts stay accurate.',
}
