import type {
  ChessMoveRecord,
  ChessPiecePlacement,
  ChessSceneLastMove,
  ChessScenePiece,
  ChessSceneSnapshot,
  ChessSquare,
} from '../../types/chess'

export const CHESS_MOVE_ANIMATION_DURATION_MS = 260

export interface ChessAnimatedPieceMotion {
  id: string
  from: ChessSquare
  to: ChessSquare
  piece: ChessPiecePlacement
}

export function createChessMoveAnimations(
  nextSnapshot: Pick<ChessSceneSnapshot, 'pieces'>,
  lastRecord: Pick<ChessMoveRecord, 'index' | 'move'> | null,
): ChessAnimatedPieceMotion[] {
  if (lastRecord === null) {
    return []
  }

  const primaryPiece =
    findPieceAtSquare(nextSnapshot.pieces, lastRecord.move.to) ?? {
      square: lastRecord.move.to,
      color: lastRecord.move.piece.color,
      type: lastRecord.move.promotion ?? lastRecord.move.piece.type,
    }
  const animations: ChessAnimatedPieceMotion[] = [
    {
      id: `${lastRecord.index}-primary`,
      from: lastRecord.move.from,
      to: lastRecord.move.to,
      piece: primaryPiece,
    },
  ]

  if (lastRecord.move.rookFrom !== null && lastRecord.move.rookTo !== null) {
    animations.push({
      id: `${lastRecord.index}-rook`,
      from: lastRecord.move.rookFrom,
      to: lastRecord.move.rookTo,
      piece:
        findPieceAtSquare(nextSnapshot.pieces, lastRecord.move.rookTo) ?? {
          square: lastRecord.move.rookTo,
          color: lastRecord.move.piece.color,
          type: 'rook',
        },
    })
  }

  return animations
}

export function filterScenePiecesForAnimation(
  pieces: ReadonlyArray<ChessScenePiece>,
  animatedPieces: ReadonlyArray<ChessAnimatedPieceMotion>,
): ChessScenePiece[] {
  if (animatedPieces.length === 0) {
    return [...pieces]
  }

  const hiddenSquares = new Set(animatedPieces.map((animation) => animation.to))

  return pieces.filter((piece) => !hiddenSquares.has(piece.square))
}

export function areSameLastMove(
  left: ChessSceneLastMove | null,
  right: ChessSceneLastMove | null,
): boolean {
  return (
    left?.from === right?.from &&
    left?.to === right?.to &&
    left?.promotion === right?.promotion
  )
}

function findPieceAtSquare(
  pieces: ReadonlyArray<ChessScenePiece>,
  square: ChessSquare,
): ChessScenePiece | undefined {
  return pieces.find((piece) => piece.square === square)
}
