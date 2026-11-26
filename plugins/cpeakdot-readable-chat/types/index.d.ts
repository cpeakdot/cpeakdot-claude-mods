// Where a tool call sits in a run of calls: 'first' after your message or a reply's text, 'inRun' after another call.
export type RunPosition = 'first' | 'inRun' | 'unknown'

declare module 'claude-code' {
  interface PluginState {
    'cpeakdot-readable-chat': { runPosition: StateFamily<RunPosition> }
  }
}
