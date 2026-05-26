import type { ChessSquare } from '../types/chess'

// Some input stacks deliver a follow-up click after pointer-down already handled the square.
// Keep the window wide enough to collapse that secondary activation into a single board action.
export const CHESS_INPUT_DEDUPLICATION_WINDOW_MS = 400
const CHESS_EVENT_TIMESTAMP_EPOCH_THRESHOLD_MS = 1_000_000_000_000

export type ChessSquareSelectSource = 'pointerdown' | 'click'
export type ChessSquareSelectPointerType = 'mouse' | 'touch' | 'pen' | 'unknown'

export interface ChessSquareSelectInput {
  source: ChessSquareSelectSource
  pointerType: ChessSquareSelectPointerType
  timestampMs?: number
}

interface PointerTypeCarrier {
  pointerType?: string
  nativeEvent?:
    | Event
    | {
        changedTouches?: {
          length?: number
        }
        pointerType?: string
        sourceCapabilities?: {
          firesTouchEvents?: boolean
        }
        touches?: {
          length?: number
        }
      }
}

export interface ChessHandledSquareSelect extends ChessSquareSelectInput {
  square: ChessSquare
  timestampMs: number
}

export interface ChessHandledSquareSelectTimestampResolution {
  timestampMs: number
  relativeEventTimestampOffsetMs: number | null
}

export function normalizeChessSquareSelectPointerType(
  pointerType: string | undefined,
): ChessSquareSelectPointerType {
  switch (pointerType) {
    case 'mouse':
    case 'touch':
    case 'pen':
      return pointerType
    default:
      return 'unknown'
  }
}

export function resolveChessSquareSelectPointerType(
  event: PointerTypeCarrier,
): ChessSquareSelectPointerType {
  return normalizeChessSquareSelectPointerType(
    event.pointerType ?? resolveNestedPointerType(event.nativeEvent),
  )
}

function resolveNestedPointerType(
  event: PointerTypeCarrier['nativeEvent'],
): string | undefined {
  if (typeof event !== 'object' || event === null) {
    return undefined
  }

  if ('pointerType' in event) {
    const pointerType = event.pointerType

    if (typeof pointerType === 'string') {
      return pointerType
    }
  }

  if (hasTouchMetadata(event)) {
    return 'touch'
  }

  return undefined
}

function hasTouchMetadata(
  event: Exclude<PointerTypeCarrier['nativeEvent'], undefined>,
): boolean {
  return (
    resolveTouchCount(event, 'touches') > 0 ||
    resolveTouchCount(event, 'changedTouches') > 0 ||
    resolveFiresTouchEvents(event) === true
  )
}

function resolveTouchCount(
  event: Exclude<PointerTypeCarrier['nativeEvent'], undefined>,
  field: 'touches' | 'changedTouches',
): number {
  const touches = (event as {
    changedTouches?: {
      length?: number
    }
    touches?: {
      length?: number
    }
  })[field]

  return typeof touches === 'object' &&
    touches !== null &&
    typeof touches.length === 'number'
    ? touches.length
    : 0
}

function resolveFiresTouchEvents(
  event: Exclude<PointerTypeCarrier['nativeEvent'], undefined>,
): boolean | undefined {
  const sourceCapabilities = (event as {
    sourceCapabilities?: {
      firesTouchEvents?: boolean
    }
  }).sourceCapabilities

  if (typeof sourceCapabilities !== 'object' || sourceCapabilities === null) {
    return undefined
  }

  const { firesTouchEvents } = sourceCapabilities

  return typeof firesTouchEvents === 'boolean' ? firesTouchEvents : undefined
}

export function shouldIgnoreDuplicateSquareSelect(
  previous: ChessHandledSquareSelect | null,
  next: ChessHandledSquareSelect,
): boolean {
  const elapsedMs =
    previous === null ? Number.POSITIVE_INFINITY : next.timestampMs - previous.timestampMs

  return (
    previous !== null &&
    elapsedMs >= 0 &&
    elapsedMs <= CHESS_INPUT_DEDUPLICATION_WINDOW_MS &&
    previous.source === 'pointerdown' &&
    previous.pointerType !== 'mouse' &&
    next.source === 'click' &&
    next.pointerType !== 'mouse'
  )
}

export function resolveChessHandledSquareSelectTimestampMs(
  eventTimestampMs: number | undefined,
  fallbackTimestampMs: number,
  relativeEventTimestampOffsetMs: number | null,
): ChessHandledSquareSelectTimestampResolution {
  if (eventTimestampMs === undefined || !Number.isFinite(eventTimestampMs)) {
    return {
      timestampMs: fallbackTimestampMs,
      relativeEventTimestampOffsetMs,
    }
  }

  if (eventTimestampMs >= CHESS_EVENT_TIMESTAMP_EPOCH_THRESHOLD_MS) {
    return {
      timestampMs: eventTimestampMs,
      relativeEventTimestampOffsetMs,
    }
  }

  if (relativeEventTimestampOffsetMs === null) {
    return {
      timestampMs: fallbackTimestampMs,
      relativeEventTimestampOffsetMs: fallbackTimestampMs - eventTimestampMs,
    }
  }

  return {
    timestampMs: eventTimestampMs + relativeEventTimestampOffsetMs,
    relativeEventTimestampOffsetMs,
  }
}
