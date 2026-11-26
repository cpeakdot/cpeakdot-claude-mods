import { expect, test } from 'claude-code/testing'

const YOU_COLOR = '#e0a84f'
const TOOL_BORDER_COLOR = '#4b5260'

test('own prompt draws in the amber box with a You label', async $ => {
  const ui = await $.ui.mount({
    plugin: 'cpeakdot-readable-chat',
    surface: 'terminal',
    component: 'UserMessage',
    props: { text: 'Fix only the second call', origin: { kind: 'composer' }, isExpanded: false },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.borderColor).toBe(YOU_COLOR)
  expect(box?.props.borderStyle).toBe('round')
  expect(box?.text).toContain('You')
  expect(box?.text).toContain('Fix only the second call')
  await ui.unmount()
})

test('a task notification keeps the engine row', async $ => {
  const ui = await $.ui.mount({
    plugin: 'cpeakdot-readable-chat',
    surface: 'terminal',
    component: 'UserMessage',
    props: {
      text: 'Build done',
      origin: { kind: 'task-notification' },
      isExpanded: false,
      task: { id: 't1', status: 'completed', durationMs: 10 },
    },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.borderColor).not.toBe(YOU_COLOR)
  await ui.unmount()
})

test('a Bash row draws in the grey box', async $ => {
  const ui = await $.ui.mount({
    plugin: 'cpeakdot-readable-chat',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_1',
      tool: 'Bash',
      input: { command: 'ls' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
    },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.borderColor).toBe(TOOL_BORDER_COLOR)
  await ui.unmount()
})

test('the desktop surface is left alone', async $ => {
  const ui = await $.ui.mount({
    plugin: 'cpeakdot-readable-chat',
    surface: 'desktop',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_2',
      tool: 'Bash',
      input: { command: 'ls' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
    },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.borderColor).not.toBe(TOOL_BORDER_COLOR)
  await ui.unmount()
})
