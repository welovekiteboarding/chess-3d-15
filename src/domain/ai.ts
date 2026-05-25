import { generateLegalMoves, generateSearchMoves, makeMove } from '../chess/engine'
import type {
  AiDifficulty,
  AiMoveRequest,
  AiMoveSelector,
  AiPieceValues,
  AiScoredMove,
} from '../types/ai'
import type {
  ChessGameState,
  ChessSquare,
  LegalMove,
  MoveInput,
  PieceColor,
} from '../types/chess'

const EASY_CAPTURE_WEIGHT = 100
const EASY_CHECKMATE_BONUS = 100_000
const EASY_CHECK_BONUS = 50
const EASY_CASTLING_BONUS = 20
const EASY_CENTER_BONUS = 10
const EASY_DEVELOPMENT_BONUS = 6
const EASY_QUIET_KING_PENALTY = 10
const MEDIUM_SEARCH_DEPTH = 2
const HARD_SEARCH_DEPTH = 3
const CHECKMATE_SCORE = 1_000_000
const MAX_RANDOM_VALUE = 0.999_999
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

interface SearchBestMoveOptions {
  alphaBeta?: boolean
  depth: number
  legalMoves?: LegalMove[]
  random?: () => number
}

interface SearchBestMoveResult {
  move: LegalMove
  nodesEvaluated: number
  score: number
}

export const AI_PIECE_VALUES: AiPieceValues = {
  king: 0,
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
}

const AI_MOVE_SELECTORS: Record<AiDifficulty, AiMoveSelector> = {
  easy: selectEasyMove,
  medium: selectMediumMove,
  hard: selectHardMove,
}

export function selectAiMove(request: AiMoveRequest): LegalMove {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  return AI_MOVE_SELECTORS[request.difficulty](request, legalMoves)
}

export function scoreEasyMove(move: LegalMove): number {
  let score = 0

  if (move.isCheckmate) {
    score += EASY_CHECKMATE_BONUS
  }

  if (move.capturedPiece !== null) {
    score += AI_PIECE_VALUES[move.capturedPiece.type] * EASY_CAPTURE_WEIGHT
  }

  if (move.promotion !== null) {
    score += AI_PIECE_VALUES[move.promotion] * EASY_CAPTURE_WEIGHT
  }

  if (move.isCheck) {
    score += EASY_CHECK_BONUS
  }

  if (move.isCastling) {
    score += EASY_CASTLING_BONUS
  }

  if (CENTER_SQUARES.has(move.to)) {
    score += EASY_CENTER_BONUS
  }

  if (isDevelopingMinorPiece(move)) {
    score += EASY_DEVELOPMENT_BONUS
  }

  if (move.piece.type === 'king' && !move.isCastling) {
    score -= EASY_QUIET_KING_PENALTY
  }

  return score
}

export function rankEasyMoves(legalMoves: LegalMove[]): AiScoredMove[] {
  return [...legalMoves]
    .map((move) => ({
      move,
      score: scoreEasyMove(move),
    }))
    .sort((left, right) => right.score - left.score)
}

export function evaluateBoard(
  game: ChessGameState,
  perspective: PieceColor,
): number {
  if (game.status === 'checkmate') {
    return game.winner === perspective ? CHECKMATE_SCORE : -CHECKMATE_SCORE
  }

  if (game.status === 'stalemate') {
    return 0
  }

  let score = 0

  for (const piece of game.pieces) {
    const materialValue = AI_PIECE_VALUES[piece.type]
    score += piece.color === perspective ? materialValue : -materialValue
  }

  return score
}

export function searchBestMove(
  game: ChessGameState,
  options: SearchBestMoveOptions,
): SearchBestMoveResult {
  const legalMoves = options.legalMoves ?? generateSearchMoves(game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot search a move from a terminal position')
  }

  const orderedMoves = orderSearchMoves(legalMoves)
  const tracker = { nodesEvaluated: 0 }
  const random = options.random ?? Math.random
  let bestScore = -Infinity
  let bestMoves: LegalMove[] = []
  let alpha = -Infinity
  let beta = Infinity

  for (const move of orderedMoves) {
    const score = minimax(
      applyLegalMove(game, move),
      options.depth - 1,
      game.turn,
      false,
      options.alphaBeta === true,
      alpha,
      beta,
      tracker,
    )

    if (score > bestScore) {
      bestScore = score
      bestMoves = [move]
    } else if (score === bestScore) {
      bestMoves.push(move)
    }

    if (options.alphaBeta === true) {
      alpha = Math.max(alpha, bestScore)
    }
  }

  return {
    move: pickRandomMove(bestMoves, random),
    score: bestScore,
    nodesEvaluated: tracker.nodesEvaluated,
  }
}

function selectEasyMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  const rankedMoves = rankEasyMoves(legalMoves)
  const highestScore = rankedMoves[0]!.score
  const bestMoves = rankedMoves
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.move)

  return pickRandomMove(bestMoves, request.random ?? Math.random)
}

function selectMediumMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return searchBestMove(request.game, {
    depth: MEDIUM_SEARCH_DEPTH,
    legalMoves,
    random: request.random,
  }).move
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return searchBestMove(request.game, {
    depth: HARD_SEARCH_DEPTH,
    alphaBeta: true,
    legalMoves,
    random: request.random,
  }).move
}

function minimax(
  game: ChessGameState,
  depth: number,
  perspective: PieceColor,
  maximizingPlayer: boolean,
  useAlphaBeta: boolean,
  alpha: number,
  beta: number,
  tracker: { nodesEvaluated: number },
): number {
  const legalMoves = generateSearchMoves(game)

  if (depth <= 0 || legalMoves.length === 0) {
    tracker.nodesEvaluated += 1
    return evaluateBoard(game, perspective)
  }

  const orderedMoves = orderSearchMoves(legalMoves)

  if (maximizingPlayer) {
    let value = -Infinity

    for (const move of orderedMoves) {
      value = Math.max(
        value,
        minimax(
          applyLegalMove(game, move),
          depth - 1,
          perspective,
          false,
          useAlphaBeta,
          alpha,
          beta,
          tracker,
        ),
      )

      if (useAlphaBeta) {
        alpha = Math.max(alpha, value)

        if (beta <= alpha) {
          break
        }
      }
    }

    return value
  }

  let value = Infinity

  for (const move of orderedMoves) {
    value = Math.min(
      value,
      minimax(
        applyLegalMove(game, move),
        depth - 1,
        perspective,
        true,
        useAlphaBeta,
        alpha,
        beta,
        tracker,
      ),
    )

    if (useAlphaBeta) {
      beta = Math.min(beta, value)

      if (beta <= alpha) {
        break
      }
    }
  }

  return value
}

function orderSearchMoves(legalMoves: LegalMove[]): LegalMove[] {
  return rankEasyMoves(legalMoves).map((entry) => entry.move)
}

function applyLegalMove(
  game: ChessGameState,
  move: LegalMove,
): ChessGameState {
  return makeMove(game, toMoveInput(move))
}

function toMoveInput(move: LegalMove): MoveInput {
  return {
    from: move.from,
    to: move.to,
    ...(move.promotion === null ? {} : { promotion: move.promotion }),
  }
}

function pickRandomMove(moves: LegalMove[], random: () => number): LegalMove {
  const index = Math.min(
    moves.length - 1,
    Math.floor(normalizeRandomValue(random()) * moves.length),
  )

  return moves[index]!
}

function normalizeRandomValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  if (value <= 0) {
    return 0
  }

  if (value >= 1) {
    return MAX_RANDOM_VALUE
  }

  return value
}

function isDevelopingMinorPiece(move: LegalMove): boolean {
  return (
    (move.piece.type === 'knight' || move.piece.type === 'bishop') &&
    isBackRank(move.from, move.piece.color)
  )
}

function isBackRank(
  square: ChessSquare,
  color: LegalMove['piece']['color'],
): boolean {
  return square[1] === (color === 'white' ? '1' : '8')
}
