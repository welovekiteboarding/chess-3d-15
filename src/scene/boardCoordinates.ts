export const BOARD_SIZE = 8
export const SQUARE_SIZE = 1
export const BOARD_EDGE_OFFSET = (BOARD_SIZE - 1) / 2
export const BOARD_SURFACE_Y = 0.14

export const BOARD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const BOARD_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export type BoardFile = (typeof BOARD_FILES)[number]
export type BoardRank = (typeof BOARD_RANKS)[number]
export type BoardSquare = `${BoardFile}${BoardRank}`
export type SquareColor = 'light' | 'dark'
export type ScenePosition = [number, number, number]

interface BoardIndices {
  fileIndex: number
  rankIndex: number
}

function squareToBoardIndices(square: BoardSquare): BoardIndices {
  const [file, rank] = square.split('') as [BoardFile, BoardRank]
  const fileIndex = BOARD_FILES.indexOf(file)
  const rankIndex = BOARD_RANKS.indexOf(rank)

  if (fileIndex === -1 || rankIndex === -1) {
    throw new Error(`Unsupported board square: ${square}`)
  }

  return { fileIndex, rankIndex }
}

export function boardIndicesToScenePosition(
  fileIndex: number,
  rankIndex: number,
  elevation = 0,
): ScenePosition {
  return [
    fileIndex * SQUARE_SIZE - BOARD_EDGE_OFFSET,
    elevation,
    BOARD_EDGE_OFFSET - rankIndex * SQUARE_SIZE,
  ]
}

export function squareToScenePosition(
  square: BoardSquare,
  elevation = 0,
): ScenePosition {
  const { fileIndex, rankIndex } = squareToBoardIndices(square)

  return boardIndicesToScenePosition(fileIndex, rankIndex, elevation)
}

export function getSquareColor(square: BoardSquare): SquareColor {
  const { fileIndex, rankIndex } = squareToBoardIndices(square)

  return (fileIndex + rankIndex) % 2 === 0 ? 'dark' : 'light'
}
