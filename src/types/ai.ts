import type { ChessGameState, LegalMove, PieceType } from './chess'

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export interface AiMoveRequest {
  game: ChessGameState
  difficulty: AiDifficulty
  random?: () => number
  seed?: number
  maxPositions?: number
}

export interface AiScoredMove {
  move: LegalMove
  score: number
}

export interface AiSearchDiagnostics {
  positionsEvaluated: number
  alphaBetaCutoffs: number
  cacheHits: number
  budgetExhausted: boolean
  completedDepth: number
}

export interface AiSearchOptions {
  depth: number
  alphaBetaPruning?: boolean
  diagnostics?: AiSearchDiagnostics
  maxPositions?: number
}

export interface AiAsyncOptions {
  yieldAfterPositions?: number
  scheduler?: () => Promise<void>
}

export interface AiAsyncSearchOptions
  extends AiSearchOptions,
    AiAsyncOptions {}

export type AiPieceValues = Record<PieceType, number>

export type AiMoveSelector = (
  request: AiMoveRequest,
  legalMoves: LegalMove[],
) => LegalMove
