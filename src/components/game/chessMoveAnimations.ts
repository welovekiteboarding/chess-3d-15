import type {
  ChessMoveRecord,
  ChessPiecePlacement,
  ChessSceneLastMove,
  ChessScenePiece,
  ChessSceneSnapshot,
  ChessSquare,
} from '../../types/chess'

export const CHESS_MOVE_ANIMATION_DURATION_MS = 260
export const CHESS_MOVE_ANIMATION_ARC_HEIGHT = 0.16

export interface ChessAnimatedPieceMotion {
  id: string
  from: ChessSquare
  to: ChessSquare
  piece: ChessPiecePlacement
}

export interface ChessAnimationPose {
  progress: number
  x: number
  y: number
  z: number
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
): ReadonlyArray<ChessScenePiece> {
  if (animatedPieces.length === 0) {
    return pieces
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

export function resolveChessAnimationPose(
  startPosition: readonly [number, number, number],
  endPosition: readonly [number, number, number],
  elapsedMs: number,
  durationMs: number = CHESS_MOVE_ANIMATION_DURATION_MS,
  arcHeight: number = CHESS_MOVE_ANIMATION_ARC_HEIGHT,
): ChessAnimationPose {
  const progress = resolveChessAnimationProgress(elapsedMs, durationMs)

  if (progress <= 0) {
    return {
      progress: 0,
      x: startPosition[0],
      y: startPosition[1],
      z: startPosition[2],
    }
  }

  if (progress >= 1) {
    return {
      progress: 1,
      x: endPosition[0],
      y: endPosition[1],
      z: endPosition[2],
    }
  }

  return {
    progress,
    x: interpolate(startPosition[0], endPosition[0], progress),
    y:
      interpolate(startPosition[1], endPosition[1], progress) +
      Math.sin(Math.PI * progress) * arcHeight,
    z: interpolate(startPosition[2], endPosition[2], progress),
  }
}

function findPieceAtSquare(
  pieces: ReadonlyArray<ChessScenePiece>,
  square: ChessSquare,
): ChessScenePiece | undefined {
  return pieces.find((piece) => piece.square === square)
}

function resolveChessAnimationProgress(
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) {
    return 1
  }

  return smoothstep(elapsedMs / durationMs)
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress
}

function smoothstep(progress: number): number {
  const clampedProgress = Math.min(1, Math.max(0, progress))

  return clampedProgress * clampedProgress * (3 - 2 * clampedProgress)
}
