import type { ChessSquare } from '../../types/chess'
import {
  resolveChessSquareSelectPointerType,
  type ChessSquareSelectInput,
} from './chessInputDeduplication'

const CHESS_MOUSE_CLICK_DRAG_TOLERANCE_PX = 6
const CHESS_MOUSE_CLICK_TRACKING_WINDOW_MS = 500

interface ChessSquareSelectEvent {
  stopPropagation(): void
  preventDefault?(): void
  button?: number
  clientX?: number
  clientY?: number
  isPrimary?: boolean
  pointerType?: string
  timeStamp?: number
  nativeEvent?:
    | Event
    | {
        button?: number
        clientX?: number
        clientY?: number
        isPrimary?: boolean
        pointerType?: string
        timeStamp?: number
      }
}

export interface ChessSquareSelectHandlerSet {
  onClick(event: ChessSquareSelectEvent): void
  onPointerDown(event: ChessSquareSelectEvent): void
}

interface ChessMousePointerDownSnapshot {
  clientX: number
  clientY: number
  timestampMs: number
}

type ChessSquareSelectCallback = NonNullable<
  Parameters<typeof createChessSquareSelectHandlers>[1]
>

const mousePointerDownSnapshots = new WeakMap<
  ChessSquareSelectCallback,
  ChessMousePointerDownSnapshot
>()

export function createChessSquareSelectHandlers(
  square: ChessSquare,
  onSquareSelect?: (square: ChessSquare, input?: ChessSquareSelectInput) => void,
): ChessSquareSelectHandlerSet {
  return {
    onClick(event) {
      if (shouldIgnoreMouseClickAfterDrag(event, onSquareSelect)) {
        event.preventDefault?.()
        event.stopPropagation()
        return
      }

      dispatchChessSquareSelect(square, 'click', event, onSquareSelect)
    },
    onPointerDown(event) {
      rememberMousePointerDown(event, onSquareSelect)
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

  // Keep mouse selection on click so press-and-drag can stay available for camera control.
  if (source === 'pointerdown' && resolveChessSquareSelectPointerType(event) === 'mouse') {
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
  field: 'button' | 'clientX' | 'clientY' | 'timeStamp',
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
  field: 'button' | 'clientX' | 'clientY' | 'isPrimary' | 'timeStamp',
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

function rememberMousePointerDown(
  event: ChessSquareSelectEvent,
  onSquareSelect?: ChessSquareSelectCallback,
) {
  if (onSquareSelect === undefined) {
    return
  }

  if (
    !isPrimarySelectionEvent('pointerdown', event) ||
    resolveChessSquareSelectPointerType(event) !== 'mouse'
  ) {
    mousePointerDownSnapshots.delete(onSquareSelect)
    return
  }

  const coordinates = resolvePointerCoordinates(event)
  const timestampMs = resolveChessSquareSelectTimestampMs(event)

  if (coordinates === undefined || timestampMs === undefined) {
    mousePointerDownSnapshots.delete(onSquareSelect)
    return
  }

  mousePointerDownSnapshots.set(onSquareSelect, {
    ...coordinates,
    timestampMs,
  })
}

function shouldIgnoreMouseClickAfterDrag(
  event: ChessSquareSelectEvent,
  onSquareSelect?: ChessSquareSelectCallback,
): boolean {
  if (onSquareSelect === undefined) {
    return false
  }

  const previousPointerDown = mousePointerDownSnapshots.get(onSquareSelect)

  mousePointerDownSnapshots.delete(onSquareSelect)

  if (previousPointerDown === undefined) {
    return false
  }

  const coordinates = resolvePointerCoordinates(event)
  const timestampMs = resolveChessSquareSelectTimestampMs(event)

  if (coordinates === undefined || timestampMs === undefined) {
    return false
  }

  const elapsedMs = timestampMs - previousPointerDown.timestampMs

  if (elapsedMs < 0 || elapsedMs > CHESS_MOUSE_CLICK_TRACKING_WINDOW_MS) {
    return false
  }

  const deltaX = coordinates.clientX - previousPointerDown.clientX
  const deltaY = coordinates.clientY - previousPointerDown.clientY

  return (
    deltaX * deltaX + deltaY * deltaY >
    CHESS_MOUSE_CLICK_DRAG_TOLERANCE_PX * CHESS_MOUSE_CLICK_DRAG_TOLERANCE_PX
  )
}

function resolvePointerCoordinates(
  event: ChessSquareSelectEvent,
): { clientX: number; clientY: number } | undefined {
  const clientX = resolveNumericEventField(event, 'clientX')
  const clientY = resolveNumericEventField(event, 'clientY')

  return clientX !== undefined && clientY !== undefined
    ? { clientX, clientY }
    : undefined
}
