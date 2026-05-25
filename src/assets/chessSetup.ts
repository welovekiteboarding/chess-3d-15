import { BOARD_FILES, type BoardRank, type BoardSquare } from '../scene/boardCoordinates'

export type PieceColor = 'white' | 'black'
export type PieceKind =
  | 'king'
  | 'queen'
  | 'rook'
  | 'bishop'
  | 'knight'
  | 'pawn'

export interface ChessPiecePlacement {
  color: PieceColor
  kind: PieceKind
  square: BoardSquare
}

const BACK_RANK_ORDER: PieceKind[] = [
  'rook',
  'knight',
  'bishop',
  'queen',
  'king',
  'bishop',
  'knight',
  'rook',
]

function makeSquare(file: string, rank: BoardRank): BoardSquare {
  return `${file}${rank}` as BoardSquare
}

function buildBackRank(
  color: PieceColor,
  rank: BoardRank,
): ChessPiecePlacement[] {
  return BOARD_FILES.map((file, index) => ({
    color,
    kind: BACK_RANK_ORDER[index]!,
    square: makeSquare(file, rank),
  }))
}

function buildPawnRank(
  color: PieceColor,
  rank: BoardRank,
): ChessPiecePlacement[] {
  return BOARD_FILES.map((file) => ({
    color,
    kind: 'pawn',
    square: makeSquare(file, rank),
  }))
}

export const INITIAL_PIECES: ChessPiecePlacement[] = [
  ...buildBackRank('white', '1'),
  ...buildPawnRank('white', '2'),
  ...buildPawnRank('black', '7'),
  ...buildBackRank('black', '8'),
]
