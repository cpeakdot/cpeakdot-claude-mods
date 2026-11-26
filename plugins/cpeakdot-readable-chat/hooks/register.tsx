import { atom, memberOf, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { RunPosition } from '../types'

// Rosé Pine (main): https://github.com/rose-pine/neovim/blob/main/lua/rose-pine/palette.lua
const COLORS = {
  you: '#f6c177', // gold
  youBar: '#a07c4a', // muted gold, calmer than the label (own pick, not a Rosé Pine colour)
  toolText: '#908caa', // subtle, 5.5:1 on the Rosé Pine base
  ok: '#9ccfd8', // foam
  failed: '#eb6f92', // love
  running: '#f6c177', // gold
} as const

const REPLY_MAX_COLUMNS = 100
const ERROR_DETAIL_MAX_CHARS = 60
const OWN_ORIGIN_KINDS = new Set(['composer', 'bridge'])
const FILE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SEARCH_TOOLS = new Set(['Grep', 'Glob'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])
const SUMMARY_INPUT_KEYS = ['description', 'command', 'file_path', 'pattern', 'query', 'url', 'prompt']
// A leading `cd <path> &&` (or `;`) only sets the folder; the line shows the command after it.
const LEADING_CD = /^cd\s+("[^"]*"|'[^']*'|\S+)\s*(&&|;)\s*/

const runPosition = atom({ plugin: 'cpeakdot-readable-chat', key: 'runPosition' } as const, 'unknown' as RunPosition)

type ToolSummary = { glyph: string; label: string }
type ToolState = { mark: string; color: string; detail: string; isFailed: boolean }
type ToolRowProps = {
  tool: string
  input: unknown
  output?: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
}

function firstLine(text: string): string {
  return (text.split('\n')[0] ?? '').trim()
}

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function inputString(input: unknown, key: string): string | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined
  }

  const value = (input as Record<string, unknown>)[key]

  return typeof value === 'string' ? value : undefined
}

function displayToolName(tool: string): string {
  return tool.startsWith('mcp__') ? tool.split('__').slice(1).join(' ') : tool
}

function summarizeTool(tool: string, input: unknown): ToolSummary {
  if (SHELL_TOOLS.has(tool)) {
    const command = firstLine(inputString(input, 'command') ?? '')

    return { glyph: '$', label: command.replace(LEADING_CD, '') || command }
  }

  const filePath = inputString(input, 'file_path') ?? inputString(input, 'notebook_path')

  if (tool === 'Read' && filePath !== undefined) {
    return { glyph: '↳', label: `Read ${baseName(filePath)}` }
  }

  if (FILE_TOOLS.has(tool) && filePath !== undefined) {
    return { glyph: '✎', label: `${tool} ${baseName(filePath)}` }
  }

  if (SEARCH_TOOLS.has(tool)) {
    return { glyph: '⌕', label: `${tool} ${inputString(input, 'pattern') ?? ''}` }
  }

  const key = SUMMARY_INPUT_KEYS.find(k => inputString(input, k) !== undefined)
  const detail = key === undefined ? '' : firstLine(inputString(input, key) ?? '')

  return { glyph: '•', label: `${displayToolName(tool)} ${detail}`.trim() }
}

function shellLineCount(output: unknown): number {
  const stdout = inputString(output, 'stdout')?.trim() ?? ''

  return stdout === '' ? 0 : stdout.split('\n').length
}

function toolState(props: ToolRowProps): ToolState {
  if (props.isRunning) {
    return { mark: '…', color: COLORS.running, detail: 'running', isFailed: false }
  }

  if (props.isInterrupted) {
    return { mark: '✗', color: COLORS.failed, detail: 'interrupted', isFailed: true }
  }

  if (props.isErrored) {
    const raw = typeof props.output === 'string' ? props.output : 'failed'
    const text = firstLine(raw.replace(/<[^>]+>/g, '')) || 'failed'

    return { mark: '✗', color: COLORS.failed, detail: text.slice(0, ERROR_DETAIL_MAX_CHARS), isFailed: true }
  }

  const lines = SHELL_TOOLS.has(props.tool) ? shellLineCount(props.output) : 0
  const detail = lines > 0 ? `${lines} ${lines === 1 ? 'line' : 'lines'}` : ''

  return { mark: '✓', color: COLORS.ok, detail, isFailed: false }
}

function isOwnMessage(origin: { kind: string }, from: unknown, task: unknown): boolean {
  // Rows stored before origin stamps read 'unclassified'; with no sender and no task they are the person's own.
  const isLegacyOwn = origin.kind === 'unclassified' && from === undefined && task === undefined

  return OWN_ORIGIN_KINDS.has(origin.kind) || isLegacyOwn
}

export const register: Register = on => {
  // True after a tool call, until a new turn (your message) or a reply's text ends the run.
  // session.append is not used: the built-in sec-default plugin skips it for user plugins.
  let isRunOpen = false
  let lastTurnId = ''

  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    const isMainLoop = e.agentId === undefined

    if (isMainLoop && e.turnId !== lastTurnId) {
      lastTurnId = e.turnId
      isRunOpen = false
    }

    for await (const chunk of stream) {
      if (isMainLoop && chunk.kind === 'text' && chunk.text.trim() !== '') {
        isRunOpen = false
      }

      if (isMainLoop && chunk.kind === 'tool') {
        const position: RunPosition = isRunOpen ? 'inRun' : 'first'
        isRunOpen = true
        await update($, memberOf(runPosition, { requestId: chunk.id }), () => position)
      }

      yield chunk
    }

    return await stream.result
  })

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const { origin, from, task, text } = e.props

    if (!isOwnMessage(origin, from, task)) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    // A one-cell coloured Box is the bar: the 'quote' border added an empty row under the message.
    return (
      <Box flexDirection="row" marginTop={1}>
        <Box width={1} backgroundColor={COLORS.youBar} />
        <Box flexDirection="column" paddingLeft={1}>
          <Text color={COLORS.you} bold>
            You
          </Text>
          <Text>{text}</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded === true) {
      return next(e)
    }

    const { glyph, label } = summarizeTool(e.props.tool, e.props.input)
    const state = toolState(e.props)
    const labelColor = state.isFailed ? COLORS.failed : COLORS.toolText
    const stateText = state.detail === '' ? state.mark : `${state.mark} ${state.detail}`
    // Unknown (a resumed session) keeps the gap, as the normal row has.
    const isInRun = (await read($, memberOf(runPosition, e))) === 'inRun'
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" marginTop={isInRun ? 0 : 1}>
        <Box flexShrink={1}>
          <Text color={labelColor} wrap="truncate-end">
            {glyph} {label}
          </Text>
        </Box>
        <Box flexShrink={0} paddingLeft={2}>
          <Text color={state.color}>{stateText}</Text>
        </Box>
      </Box>
    )
  })

  // The one-line tool row above carries the state; the full result shows under ctrl+o.
  on('ui.render', { component: 'ToolResult' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isExpanded === true) {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)

    return <Box />
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const columns = e.viewport?.columns

    if (e.surface !== 'terminal' || columns === undefined || columns <= REPLY_MAX_COLUMNS) {
      return next(e)
    }

    const row = await next(e)
    const { Box } = $.ui.resolve(e)

    // A width on a Box around the engine row is refused; right padding narrows it the same way.
    return <Box paddingRight={columns - REPLY_MAX_COLUMNS}>{row}</Box>
  })
}
