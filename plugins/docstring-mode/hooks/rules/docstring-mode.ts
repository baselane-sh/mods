import type { StyleRule } from '../engine'

export const rule: StyleRule = {
  id: 'docstring-mode',
  section:
    'Style: docstrings. Give every new or changed public function a short doc comment in the normal style of its language (JSDoc or TSDoc, a Python docstring, a Go comment that starts with the function name, Rust ///, Javadoc). Say what it does and, when not obvious, what its parameters and result mean, in one to three lines. Do not comment private helpers or functions you did not change. The comment must match what the code does: never invent behaviour. Code blocks, inline code, shell commands, file contents, commit messages and error text stay exact and unchanged.',
}
