import { expect, test } from 'claude-code/testing'

const PLUGIN = 'cpeakdot-readable-chat'
const YOU_COLOR = '#f6c177'
const YOU_BAR_COLOR = '#a07c4a'
const FAILED_COLOR = '#eb6f92'

const BASH_ROW = {
  tool_use_id: 'toolu_1',
  tool: 'Bash',
  input: { command: 'ls -la' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
}

test('own prompt draws with the gold left bar and a You label', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'UserMessage',
    props: { text: 'Fix only the second call', origin: { kind: 'composer' }, isExpanded: false },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.marginTop).toBe(1)
  expect(box?.props.borderStyle).toBeUndefined()
  const boxes = await ui.findAll({ type: 'Box' })
  const bar = boxes.find(b => b.props.backgroundColor === YOU_BAR_COLOR)
  expect(bar?.props.width).toBe(1)
  const message = await ui.find({ type: 'Text', text: 'Fix only the second call' })
  expect(message?.props.bold).toBeUndefined()
  expect(box?.text).toContain('You')
  expect(box?.text).toContain('Fix only the second call')
  await ui.unmount()
})

test('a task notification keeps the engine row', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
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

test('a finished Bash call is one line with a check mark and a line count', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, output: { stdout: 'a\nb\nc\n', stderr: '' } },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.text).toContain('$ ls -la')
  expect(box?.text).toContain('✓ 3 lines')
  await ui.unmount()
})

test('a failed Bash call shows a cross and the first error line in red', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, isErrored: true, output: '<tool_use_error>Exit code 1\nmore</tool_use_error>' },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.text).toContain('✗ Exit code 1')
  expect(box?.text).not.toContain('more')
  const label = await ui.find({ type: 'Text', text: '$ ls -la' })
  expect(label?.props.color).toBe(FAILED_COLOR)
  await ui.unmount()
})

test('a call of unknown position keeps the blank line above it', async $ => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'ToolUse', props: BASH_ROW })

  expect((await ui.find({ type: 'Box' }))?.props.marginTop).toBe(1)
  await ui.unmount()
})

test('the first call after reply text has a blank line, the next call in the run has none', async ($, on) => {
  // A fake model beneath the plugins: text, then two tool calls in one response.
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'Checking.' } as never
    yield { kind: 'tool', index: 1, id: 'toolu_first', name: 'Bash' } as never
    yield { kind: 'tool', index: 2, id: 'toolu_run', name: 'Bash' } as never

    return { turnId: 'turn_1', index: 0, answer: 'Checking.', toolUses: [], stopReason: 'tool_use', usage: null } as never
  })

  const stream = $.turn.step({ turnId: 'turn_1', index: 0, model: 'test-model', messageCount: 1 })
  for await (const _chunk of stream) {
    // Read the stream to its end so the plugin sees every chunk.
  }
  const first = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'toolu_first',
    props: { ...BASH_ROW, tool_use_id: 'toolu_first' },
  })
  expect((await first.find({ type: 'Box' }))?.props.marginTop).toBe(1)
  await first.unmount()

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    requestId: 'toolu_run',
    props: { ...BASH_ROW, tool_use_id: 'toolu_run' },
  })

  expect((await ui.find({ type: 'Box' }))?.props.marginTop).toBe(0)
  await ui.unmount()
})

test('a leading cd is hidden from the tool line', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, input: { command: 'cd "/c/My Repo" && git status --short' } },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.text).toContain('$ git status --short')
  expect(box?.text).not.toContain('cd ')
  await ui.unmount()
})

test('a running call shows the running mark', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, isRunning: true },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.text).toContain('… running')
  await ui.unmount()
})

test('a Read call names the file only', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, tool: 'Read', input: { file_path: 'C:\\proj\\Assets\\LevelTimer.cs' }, output: {} },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.text).toContain('↳ Read LevelTimer.cs')
  await ui.unmount()
})

test('ctrl+o (expanded) keeps the engine tool row', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, isExpanded: true },
  })

  expect(await ui.find({ type: 'Text', text: '$ ls -la' })).toBeUndefined()
  await ui.unmount()
})

test('the tool result block is hidden until ctrl+o', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolResult',
    props: { tool_use_id: 'toolu_1', tool: 'Bash', output: { stdout: 'a', stderr: '' }, isErrored: false, isExpanded: false },
  })

  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
})

test('a reply is held to 100 columns on a wide terminal', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { text: 'Removed the call.', isFirstOfReply: true },
    viewport: { columns: 160, rows: 40 },
  })

  const box = await ui.find({ type: 'Box' })
  expect(box?.props.paddingRight).toBe(60)
  await ui.unmount()
})

test('the desktop surface is left alone', async $ => {
  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'desktop',
    component: 'ToolUse',
    props: BASH_ROW,
  })

  expect(await ui.find({ type: 'Text', text: '$ ls -la' })).toBeUndefined()
  await ui.unmount()
})
