import { createChessPositionKey } from '../chess/engine'
import type { AiDifficulty } from '../types/ai'
import type {
  ChessGameState,
  GameStatus,
  LegalMove,
  PieceColor,
} from '../types/chess'
import { AiMoveWorkerClient } from '../workers/aiMove'
import { isHumanVsAiMode, type ChessAiMatchSettings } from './gameMode'

export interface ChessAiMoveRequest {
  difficulty: AiDifficulty
  game: ChessGameState
  randomSeed: number
}

export interface ChessAiMoveClient {
  dispose: () => void
  selectMove: (request: ChessAiMoveRequest) => Promise<LegalMove>
}

export const DEFAULT_CHESS_AI_COLOR: PieceColor = 'black'
const ACTIVE_CHESS_AI_STATUSES: readonly GameStatus[] = ['active', 'check']

export function createChessAiMoveClient(): ChessAiMoveClient {
  return new AiMoveWorkerClient()
}

export function isChessAiControlledTurn(
  settings: ChessAiMatchSettings,
  game: Pick<ChessGameState, 'status' | 'turn'>,
  aiColor: PieceColor = DEFAULT_CHESS_AI_COLOR,
): boolean {
  return (
    isHumanVsAiMode(settings) &&
    game.turn === aiColor &&
    ACTIVE_CHESS_AI_STATUSES.includes(game.status)
  )
}

export function createChessAiRandomSeed(game: ChessGameState): number {
  const positionKey = createChessPositionKey(game)
  let hash = 2166136261

  for (let index = 0; index < positionKey.length; index += 1) {
    hash ^= positionKey.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}
