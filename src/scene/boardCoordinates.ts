export const BOARD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const BOARD_RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const BOARD_DIMENSION = 8
export const BOARD_EDGE_OFFSET = (BOARD_DIMENSION - 1) / 2
export const BOARD_PLAYABLE_LIMIT = BOARD_DIMENSION / 2

export type BoardFile = (typeof BOARD_FILES)[number]
export type BoardRank = (typeof BOARD_RANKS)[number]
export type BoardSquare = `${BoardFile}${BoardRank}`
export type ScenePosition = [number, number, number]

export function boardSquareToScenePosition(
  square: BoardSquare,
  elevation = 0,
): ScenePosition {
  const file = square[0] as BoardFile
  const rank = Number(square[1]) as BoardRank
  const fileIndex = BOARD_FILES.indexOf(file)

  return [
    fileIndex - BOARD_EDGE_OFFSET,
    elevation,
    BOARD_EDGE_OFFSET - (rank - 1),
  ]
}

export function scenePositionToBoardSquare(
  position: ScenePosition,
): BoardSquare | null {
  const [x, , z] = position

  if (
    x <= -BOARD_PLAYABLE_LIMIT ||
    x >= BOARD_PLAYABLE_LIMIT ||
    z <= -BOARD_PLAYABLE_LIMIT ||
    z >= BOARD_PLAYABLE_LIMIT
  ) {
    return null
  }

  const fileIndex = Math.round(x + BOARD_EDGE_OFFSET)
  const rank = Math.round(BOARD_EDGE_OFFSET - z) + 1
  const file = BOARD_FILES[fileIndex]

  if (!file || !BOARD_RANKS.includes(rank as BoardRank)) {
    return null
  }

  return `${file}${rank}` as BoardSquare
}
