export const CHESS_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const
export const CHESS_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

export type ChessFile = (typeof CHESS_FILES)[number]
export type ChessRank = (typeof CHESS_RANKS)[number]
export type ChessSquare = `${ChessFile}${ChessRank}`

export type PieceColor = 'white' | 'black'
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'
export type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>
export type GameStatus =
  | 'active'
  | 'check'
  | 'checkmate'
  | 'stalemate'
  | 'draw'
  | 'resigned'

export interface ChessPiece {
  color: PieceColor
  type: PieceType
}

export interface ChessPiecePlacement extends ChessPiece {
  square: ChessSquare
}

export interface CastlingRights {
  kingSide: boolean
  queenSide: boolean
}

export type CastlingRightsByColor = Record<PieceColor, CastlingRights>

export interface MoveInput {
  from: string
  to: string
  promotion?: PromotionPieceType
}

export interface ChessGameOptions {
  pieces?: ChessPiecePlacement[]
  turn?: PieceColor
  castlingRights?: Partial<Record<PieceColor, Partial<CastlingRights>>>
  enPassantTarget?: string | null
  halfmoveClock?: number
  fullmoveNumber?: number
}

export interface ChessMove {
  from: ChessSquare
  to: ChessSquare
  piece: ChessPiece
  capturedPiece: ChessPiece | null
  promotion: PromotionPieceType | null
  isCapture: boolean
  isCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isCastling: boolean
  isEnPassant: boolean
  rookFrom: ChessSquare | null
  rookTo: ChessSquare | null
}

export interface ChessPositionState {
  pieces: ChessPiecePlacement[]
  turn: PieceColor
  castlingRights: CastlingRightsByColor
  enPassantTarget: ChessSquare | null
  halfmoveClock: number
  fullmoveNumber: number
}

export interface ChessPositionSnapshot extends ChessPositionState {
  status: GameStatus
  checkedColor: PieceColor | null
  winner: PieceColor | null
}

export interface ChessMoveRecord {
  index: number
  input: MoveInput
  move: ChessMove
  before: ChessPositionSnapshot
  after: ChessPositionSnapshot
}

export interface ChessGameState extends ChessPositionSnapshot {
  history: ChessMoveRecord[]
}

export type ChessScenePiece = ChessPiecePlacement

export interface ChessSceneLastMove {
  from: ChessSquare
  to: ChessSquare
  promotion: PromotionPieceType | null
}

export interface ChessSceneSnapshot {
  pieces: ReadonlyArray<ChessScenePiece>
  turn: PieceColor
  status: GameStatus
  checkedColor: PieceColor | null
  winner: PieceColor | null
  lastMove: ChessSceneLastMove | null
}

export type ChessSceneListener = (snapshot: ChessSceneSnapshot) => void

export interface ChessSceneBinding {
  getGame(): ChessGameState
  getSnapshot(): ChessSceneSnapshot
  move(input: MoveInput): ChessSceneSnapshot
  restart(): ChessSceneSnapshot
  resign(resignedColor?: PieceColor): ChessSceneSnapshot
  subscribe(listener: ChessSceneListener): () => void
}

export type LegalMove = ChessMove
