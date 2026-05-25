import type { ChessGameState, LegalMove, PieceType } from './chess'

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export interface AiMoveRequest {
  game: ChessGameState
  difficulty: AiDifficulty
  random?: () => number
  seed?: number
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
  aborted: boolean
}

export interface AiSearchOptions {
  depth: number
  alphaBetaPruning?: boolean
  diagnostics?: AiSearchDiagnostics
  positionBudget?: number
}

export type AiPieceValues = Record<PieceType, number>

export type AiMoveSelector = (
  request: AiMoveRequest,
  legalMoves: LegalMove[],
) => LegalMove
