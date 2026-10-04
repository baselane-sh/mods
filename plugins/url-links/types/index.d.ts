// The state the render rules draw from. The build copies this file into the
// mod as its contract (plugin.json "types"), with the token below replaced by
// the mod's name: only the plugin that owns a `$.state` value may write it.

// How long one tool call ran, in milliseconds.
export type DurationMs = number

declare module 'claude-code' {
  interface PluginState {
    'url-links': {
      // How long each tool call ran, in milliseconds, by tool_use_id: the
      // PostToolUse duration, permission prompts and hooks not counted.
      durations: StateFamily<DurationMs>
    }
  }
}
