import type { ChessSquare } from '../../types/chess'
import {
  resolveChessSquareSelectPointerType,
  type ChessSquareSelectInput,
} from './chessInputDeduplication'

interface ChessSquareSelectEvent {
  stopPropagation(): void
  pointerType?: string
  nativeEvent?: Event | { pointerType?: string }
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
  event.stopPropagation()
  onSquareSelect?.(square, {
    source,
    pointerType: resolveChessSquareSelectPointerType(event),
  })
}
