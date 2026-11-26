import type { Register } from 'claude-code'

const YOU_COLOR = '#e0a84f'
const TOOL_BORDER_COLOR = '#4b5260'

const OWN_ORIGIN_KINDS = new Set(['composer', 'bridge'])

const TOOL_BOX_STYLE = {
  flexDirection: 'column',
  borderStyle: 'round',
  borderColor: TOOL_BORDER_COLOR,
  paddingX: 1,
} as const

export const register: Register = on => {
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const { origin, from, task, text } = e.props
    // Rows stored before origin stamps read 'unclassified'; with no sender and no task they are the person's own.
    const isLegacyOwn = origin.kind === 'unclassified' && from === undefined && task === undefined
    const isOwn = OWN_ORIGIN_KINDS.has(origin.kind) || isLegacyOwn

    if (!isOwn) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={YOU_COLOR} paddingX={1}>
        <Text color={YOU_COLOR} bold>
          You
        </Text>
        <Text bold>{text}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const row = await next(e)
    const { Box } = $.ui.resolve(e)

    return (
      <Box {...TOOL_BOX_STYLE}>{row}</Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }

    const row = await next(e)
    const { Box } = $.ui.resolve(e)

    return (
      <Box {...TOOL_BOX_STYLE}>{row}</Box>
    )
  })
}
