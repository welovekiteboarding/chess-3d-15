import type { ChessSquare } from '../../types/chess'

export const CHESS_INPUT_DEDUPLICATION_WINDOW_MS = 96

export interface ChessHandledSquareSelect {
  square: ChessSquare
  moveIndex: number
  timestampMs: number
}

export function shouldIgnoreDuplicateSquareSelect(
  previous: ChessHandledSquareSelect | null,
  next: ChessHandledSquareSelect,
): boolean {
  return (
    previous !== null &&
    previous.square === next.square &&
    previous.moveIndex === next.moveIndex &&
    next.timestampMs - previous.timestampMs <= CHESS_INPUT_DEDUPLICATION_WINDOW_MS
  )
}
