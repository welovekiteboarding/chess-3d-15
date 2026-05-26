import type { ChessSquare } from '../../types/chess'

// Some input stacks deliver a follow-up click after pointer-down already handled the square.
// Keep the window wide enough to collapse that secondary activation into a single board action.
export const CHESS_INPUT_DEDUPLICATION_WINDOW_MS = 400

export type ChessSquareSelectSource = 'pointerdown' | 'click'
export type ChessSquareSelectPointerType = 'mouse' | 'touch' | 'pen' | 'unknown'

export interface ChessSquareSelectInput {
  source: ChessSquareSelectSource
  pointerType: ChessSquareSelectPointerType
}

interface PointerTypeCarrier {
  pointerType?: string
  nativeEvent?: Event | { pointerType?: string }
}

export interface ChessHandledSquareSelect extends ChessSquareSelectInput {
  square: ChessSquare
  timestampMs: number
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
  if (typeof event !== 'object' || event === null || !('pointerType' in event)) {
    return undefined
  }

  const pointerType = event.pointerType

  return typeof pointerType === 'string' ? pointerType : undefined
}

export function shouldIgnoreDuplicateSquareSelect(
  previous: ChessHandledSquareSelect | null,
  next: ChessHandledSquareSelect,
): boolean {
  const elapsedMs =
    previous === null ? Number.POSITIVE_INFINITY : next.timestampMs - previous.timestampMs

  return (
    previous !== null &&
    previous.square === next.square &&
    elapsedMs >= 0 &&
    elapsedMs <= CHESS_INPUT_DEDUPLICATION_WINDOW_MS &&
    previous.source === 'pointerdown' &&
    next.source === 'click'
  )
}
