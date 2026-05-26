import { createChessPositionKey, generateLegalMoves } from '../chess/engine'
import { selectAiMove } from '../domain/ai'
import type { AiDifficulty } from '../types/ai'
import type {
  ChessGameState,
  ChessSquare,
  LegalMove,
  PromotionPieceType,
} from '../types/chess'

export interface ChessHint {
  from: ChessSquare
  to: ChessSquare
  promotion: PromotionPieceType | null
}

export interface ChessHintState {
  isVisible: boolean
  hint: ChessHint | null
}

export interface ChessHintRequest {
  game: ChessGameState
  difficulty?: AiDifficulty
  random?: () => number
}

export interface ChessHintStateSyncRequest extends ChessHintRequest {
  state: ChessHintState
  behavior: 'dismiss' | 'replace'
}

export const DEFAULT_HINT_DIFFICULTY: AiDifficulty = 'hard'
const hintPositionKeys = new WeakMap<ChessHintState, string>()

export function createChessHintState(): ChessHintState {
  return {
    isVisible: false,
    hint: null,
  }
}

export function requestChessHint(
  request: ChessHintRequest,
): ChessHint | null {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    return null
  }

  const move = selectAiMove({
    game: request.game,
    difficulty: request.difficulty ?? DEFAULT_HINT_DIFFICULTY,
    random: request.random ?? (() => 0),
  })
  const legalMove = legalMoves.find((candidate) => isSameMove(candidate, move))

  if (legalMove === undefined) {
    return null
  }

  return {
    from: legalMove.from,
    to: legalMove.to,
    promotion: legalMove.promotion,
  }
}

export function showChessHintState(
  request: ChessHintRequest,
): ChessHintState {
  const hint = requestChessHint(request)

  if (hint === null) {
    return createChessHintState()
  }

  const state: ChessHintState = {
    isVisible: true,
    hint,
  }

  hintPositionKeys.set(state, createChessPositionKey(request.game))

  return state
}

export function dismissChessHintState(): ChessHintState {
  return createChessHintState()
}

export function syncChessHintState(
  request: ChessHintStateSyncRequest,
): ChessHintState {
  if (!request.state.isVisible) {
    return request.state
  }

  const currentPositionKey = createChessPositionKey(request.game)

  if (hintPositionKeys.get(request.state) === currentPositionKey) {
    return request.state
  }

  return request.behavior === 'replace'
    ? showChessHintState(request)
    : dismissChessHintState()
}

function isSameMove(left: LegalMove, right: LegalMove): boolean {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.promotion === right.promotion
  )
}
