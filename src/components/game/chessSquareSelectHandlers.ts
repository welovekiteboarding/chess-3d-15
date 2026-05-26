import type { ChessSquare } from '../../types/chess'
import {
  resolveChessSquareSelectPointerType,
  type ChessSquareSelectInput,
} from './chessInputDeduplication'

interface ChessSquareSelectEvent {
  stopPropagation(): void
  preventDefault?(): void
  button?: number
  isPrimary?: boolean
  pointerType?: string
  timeStamp?: number
  nativeEvent?:
    | Event
    | {
        button?: number
        isPrimary?: boolean
        pointerType?: string
        timeStamp?: number
      }
}

export interface ChessSquareSelectHandlerSet {
  onClick(event: ChessSquareSelectEvent): void
  onPointerDown(event: ChessSquareSelectEvent): void
}

export function createChessSquareSelectHandlers(
  square: ChessSquare,
  onSquareSelect?: (square: ChessSquare, input?: ChessSquareSelectInput) => void,
): ChessSquareSelectHandlerSet {
  return {
    onClick(event) {
      dispatchChessSquareSelect(square, 'click', event, onSquareSelect)
    },
    onPointerDown(event) {
      dispatchChessSquareSelect(square, 'pointerdown', event, onSquareSelect)
    },
  }
}

function dispatchChessSquareSelect(
  square: ChessSquare,
  source: ChessSquareSelectInput['source'],
  event: ChessSquareSelectEvent,
  onSquareSelect?: (square: ChessSquare, input?: ChessSquareSelectInput) => void,
) {
  event.preventDefault?.()
  event.stopPropagation()

  if (!isPrimarySelectionEvent(source, event)) {
    return
  }

  const timestampMs = resolveChessSquareSelectTimestampMs(event)

  onSquareSelect?.(square, {
    source,
    pointerType: resolveChessSquareSelectPointerType(event),
    ...(timestampMs === undefined ? {} : { timestampMs }),
  })
}

function isPrimarySelectionEvent(
  source: ChessSquareSelectInput['source'],
  event: ChessSquareSelectEvent,
): boolean {
  const button = resolveNumericEventField(event, 'button')

  if (button !== undefined && button !== 0) {
    return false
  }

  if (source !== 'pointerdown') {
    return true
  }

  const isPrimary = resolveBooleanEventField(event, 'isPrimary')

  return isPrimary !== false
}

function resolveChessSquareSelectTimestampMs(
  event: ChessSquareSelectEvent,
): number | undefined {
  const timestampMs = resolveNumericEventField(event, 'timeStamp')

  return timestampMs !== undefined && Number.isFinite(timestampMs)
    ? timestampMs
    : undefined
}

function resolveNumericEventField(
  event: ChessSquareSelectEvent,
  field: 'button' | 'timeStamp',
): number | undefined {
  const value = resolveEventField(event, field)

  return typeof value === 'number' ? value : undefined
}

function resolveBooleanEventField(
  event: ChessSquareSelectEvent,
  field: 'isPrimary',
): boolean | undefined {
  const value = resolveEventField(event, field)

  return typeof value === 'boolean' ? value : undefined
}

function resolveEventField(
  event: ChessSquareSelectEvent,
  field: 'button' | 'isPrimary' | 'timeStamp',
): unknown {
  if (field in event) {
    const value = event[field]

    if (value !== undefined) {
      return value
    }
  }

  const { nativeEvent } = event

  if (typeof nativeEvent !== 'object' || nativeEvent === null || !(field in nativeEvent)) {
    return undefined
  }

  return (nativeEvent as Record<typeof field, unknown>)[field]
}
