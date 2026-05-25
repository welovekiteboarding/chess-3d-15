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

export interface AiMoveAnalysis {
  move: LegalMove
  score: number
  searchDepth: number
  nodesVisited: number
  prunedBranches: number
}

export type AiPieceValues = Record<PieceType, number>
