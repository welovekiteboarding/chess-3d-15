import { BOARD_FILES, type BoardFile, type BoardSquare } from './boardCoordinates'

export type PieceColor = 'white' | 'black'
export type PieceKind =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn'

export interface PiecePlacement {
  color: PieceColor
  kind: PieceKind
  square: BoardSquare
}

const BACK_RANK_LAYOUT: Record<BoardFile, PieceKind> = {
  a: 'rook',
  b: 'knight',
  c: 'bishop',
  d: 'queen',
  e: 'king',
  f: 'bishop',
  g: 'knight',
  h: 'rook',
}

export function createStartingPieceLayout(): PiecePlacement[] {
  return [
    ...BOARD_FILES.map((file) => ({
      color: 'white' as const,
      kind: BACK_RANK_LAYOUT[file],
      square: `${file}1` as BoardSquare,
    })),
    ...BOARD_FILES.map((file) => ({
      color: 'white' as const,
      kind: 'pawn' as const,
      square: `${file}2` as BoardSquare,
    })),
    ...BOARD_FILES.map((file) => ({
      color: 'black' as const,
      kind: 'pawn' as const,
      square: `${file}7` as BoardSquare,
    })),
    ...BOARD_FILES.map((file) => ({
      color: 'black' as const,
      kind: BACK_RANK_LAYOUT[file],
      square: `${file}8` as BoardSquare,
    })),
  ]
}

export const startingPieceLayout = createStartingPieceLayout()
