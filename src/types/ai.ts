import type { ChessGameState, LegalMove, PieceType } from './chess'

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export interface AiMoveRequest {
  game: ChessGameState
  difficulty: AiDifficulty
  random?: () => number
}

export interface AiScoredMove {
  move: LegalMove
  score: number
}

export interface AiSearchDiagnostics {
  positionsEvaluated: number
  alphaBetaCutoffs: number
}

export interface AiSearchOptions {
  depth: number
  alphaBetaPruning?: boolean
  diagnostics?: AiSearchDiagnostics
}

export type AiPieceValues = Record<PieceType, number>

export type AiMoveSelector = (
  request: AiMoveRequest,
  legalMoves: LegalMove[],
) => LegalMove
