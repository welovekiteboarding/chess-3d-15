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
  const elapsedMs =
    previous === null ? Number.POSITIVE_INFINITY : next.timestampMs - previous.timestampMs

  return (
    previous !== null &&
    previous.square === next.square &&
    previous.moveIndex === next.moveIndex &&
    elapsedMs >= 0 &&
    elapsedMs <= CHESS_INPUT_DEDUPLICATION_WINDOW_MS
  )
}
