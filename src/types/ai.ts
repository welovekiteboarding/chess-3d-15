import type { ChessGameState, LegalMove } from './chess'

export type AiDifficulty = 'easy' | 'medium' | 'hard'
export type AiAlgorithm = 'rule-based' | 'minimax' | 'alpha-beta'

export interface AiMoveRequest {
  game: ChessGameState
  difficulty: AiDifficulty
  seed?: number
  timeBudgetMs?: number
}

export interface AiMoveSelection {
  move: LegalMove
  difficulty: AiDifficulty
  algorithm: AiAlgorithm
  searchDepth: number
  nodesEvaluated: number
  score: number
  durationMs: number
}

export interface RequestAiMoveOptions {
  useWorker?: boolean
}

export interface AiWorkerRequest {
  requestId: string
  request: AiMoveRequest
}

export interface AiWorkerSuccessResponse {
  requestId: string
  selection: AiMoveSelection
  error: null
}

export interface AiWorkerErrorResponse {
  requestId: string
  selection: null
  error: string
}

export type AiWorkerResponse =
  | AiWorkerSuccessResponse
  | AiWorkerErrorResponse
