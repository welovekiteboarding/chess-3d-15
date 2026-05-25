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
  transpositionHits: number
  completedDepth: number
  searchAborted: boolean
}

export interface AiSearchOptions {
  depth: number
  alphaBetaPruning?: boolean
  positionBudget?: number
  diagnostics?: AiSearchDiagnostics
}

export type AiPieceValues = Record<PieceType, number>

export type AiMoveSelector = (
  request: AiMoveRequest,
  legalMoves: LegalMove[],
) => LegalMove
