import { selectAiMove } from '../domain/ai'
import type { AiDifficulty } from '../types/ai'
import type { ChessGameState, ChessSquare, PromotionPieceType } from '../types/chess'

export interface ChessHint {
  from: ChessSquare
  to: ChessSquare
  promotion: PromotionPieceType | null
}

export interface ChessHintRequest {
  game: ChessGameState
  difficulty?: AiDifficulty
  random?: () => number
}

export const DEFAULT_HINT_DIFFICULTY: AiDifficulty = 'hard'

export function requestChessHint(
  request: ChessHintRequest,
): ChessHint | null {
  if (
    request.game.status === 'checkmate' ||
    request.game.status === 'stalemate'
  ) {
    return null
  }

  const move = selectAiMove({
    game: request.game,
    difficulty: request.difficulty ?? DEFAULT_HINT_DIFFICULTY,
    random: request.random ?? (() => 0),
  })

  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  }
}
