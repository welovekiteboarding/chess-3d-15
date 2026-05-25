import {
  CHESS_FILES,
  CHESS_RANKS,
  type CastlingRightsByColor,
  type ChessFile,
  type ChessRank,
  type ChessSquare,
  type PieceColor,
} from '../types/chess'

export interface SquareCoordinates {
  fileIndex: number
  rankIndex: number
}

export function isChessSquare(value: string): value is ChessSquare {
  if (value.length !== 2) {
    return false
  }

  const file = value[0] as ChessFile | undefined
  const rank = value[1] as ChessRank | undefined

  return (
    file !== undefined &&
    rank !== undefined &&
    CHESS_FILES.includes(file) &&
    CHESS_RANKS.includes(rank)
  )
}

export function parseSquare(value: string): ChessSquare {
  if (!isChessSquare(value)) {
    throw new Error(`Unsupported chess square: ${value}`)
  }

  return value
}

export function squareToCoordinates(square: ChessSquare): SquareCoordinates {
  const file = square[0] as ChessFile
  const rank = square[1] as ChessRank
  const fileIndex = CHESS_FILES.indexOf(file)
  const rankIndex = CHESS_RANKS.indexOf(rank)

  if (fileIndex === -1 || rankIndex === -1) {
    throw new Error(`Unsupported chess square: ${square}`)
  }

  return { fileIndex, rankIndex }
}

export function coordinatesToSquare(
  fileIndex: number,
  rankIndex: number,
): ChessSquare | null {
  const file = CHESS_FILES[fileIndex]
  const rank = CHESS_RANKS[rankIndex]

  if (file === undefined || rank === undefined) {
    return null
  }

  return `${file}${rank}` as ChessSquare
}

export function oppositeColor(color: PieceColor): PieceColor {
  return color === 'white' ? 'black' : 'white'
}

export function cloneCastlingRights(
  rights: CastlingRightsByColor,
): CastlingRightsByColor {
  return {
    white: { ...rights.white },
    black: { ...rights.black },
  }
}
