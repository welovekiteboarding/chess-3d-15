import { generateLegalMoves, makeMove } from '../chess/engine'
import type {
  AiDifficulty,
  AiMoveRequest,
  AiMoveSelector,
  AiPieceValues,
  AiSearchDiagnostics,
  AiSearchOptions,
  AiScoredMove,
} from '../types/ai'
import type { ChessGameState, ChessSquare, LegalMove, PieceColor } from '../types/chess'

const EASY_CAPTURE_WEIGHT = 100
const EASY_CHECKMATE_BONUS = 100_000
const EASY_CHECK_BONUS = 50
const EASY_CASTLING_BONUS = 20
const EASY_CENTER_BONUS = 10
const EASY_DEVELOPMENT_BONUS = 6
const EASY_QUIET_KING_PENALTY = 10
const MAX_RANDOM_VALUE = 0.999_999
const SEARCH_CHECK_BONUS = 0.5
const SEARCH_CENTER_CONTROL_BONUS = 0.15
const SEARCH_PAWN_ADVANCEMENT_BONUS = 0.05
const SEARCH_CHECKMATE_SCORE = 1_000_000
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

export const AI_SEARCH_DEPTHS = {
  medium: 2,
  hard: 3,
} as const

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

export function createAiSearchDiagnostics(): AiSearchDiagnostics {
  return {
    positionsEvaluated: 0,
    alphaBetaCutoffs: 0,
  }
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

export function searchBestMove(
  request: AiMoveRequest,
  options: AiSearchOptions,
): LegalMove {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  return selectSearchMove(request, legalMoves, options)
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
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.medium,
  })
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.hard,
    alphaBetaPruning: true,
  })
}

function selectSearchMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  options: AiSearchOptions,
): LegalMove {
  const random = request.random ?? Math.random
  const maximizingColor = request.game.turn
  const orderedMoves = orderMovesForSearch(legalMoves)
  const bestMoves: LegalMove[] = []
  const useAlphaBeta = options.alphaBetaPruning ?? false
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    const nextGame = applyMove(request.game, move)
    const score = minimax(
      nextGame,
      options.depth - 1,
      maximizingColor,
      useAlphaBeta,
      alpha,
      beta,
      options.diagnostics,
    )

    if (score > bestScore) {
      bestScore = score
      bestMoves.length = 0
      bestMoves.push(move)
    } else if (score === bestScore) {
      bestMoves.push(move)
    }

    if (useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }
  }

  return pickRandomMove(bestMoves, random)
}

function minimax(
  game: ChessGameState,
  depth: number,
  maximizingColor: PieceColor,
  useAlphaBeta: boolean,
  alpha: number,
  beta: number,
  diagnostics?: AiSearchDiagnostics,
): number {
  if (diagnostics !== undefined) {
    diagnostics.positionsEvaluated += 1
  }

  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate') {
    return evaluateBoard(game, maximizingColor, depth)
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    return evaluateBoard(game, maximizingColor, depth)
  }

  const orderedMoves = orderMovesForSearch(legalMoves)

  if (game.turn === maximizingColor) {
    let bestScore = Number.NEGATIVE_INFINITY

    for (const move of orderedMoves) {
      const score = minimax(
        applyMove(game, move),
        depth - 1,
        maximizingColor,
        useAlphaBeta,
        alpha,
        beta,
        diagnostics,
      )
      bestScore = Math.max(bestScore, score)

      if (!useAlphaBeta) {
        continue
      }

      alpha = Math.max(alpha, bestScore)

      if (alpha >= beta) {
        if (diagnostics !== undefined) {
          diagnostics.alphaBetaCutoffs += 1
        }
        break
      }
    }

    return bestScore
  }

  let bestScore = Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    const score = minimax(
      applyMove(game, move),
      depth - 1,
      maximizingColor,
      useAlphaBeta,
      alpha,
      beta,
      diagnostics,
    )
    bestScore = Math.min(bestScore, score)

    if (!useAlphaBeta) {
      continue
    }

    beta = Math.min(beta, bestScore)

    if (alpha >= beta) {
      if (diagnostics !== undefined) {
        diagnostics.alphaBetaCutoffs += 1
      }
      break
    }
  }

  return bestScore
}

function evaluateBoard(
  game: ChessGameState,
  maximizingColor: PieceColor,
  depth: number,
): number {
  if (game.status === 'checkmate') {
    return game.winner === maximizingColor
      ? SEARCH_CHECKMATE_SCORE + depth
      : -SEARCH_CHECKMATE_SCORE - depth
  }

  if (game.status === 'stalemate') {
    return 0
  }

  let score = 0

  for (const piece of game.pieces) {
    const direction = piece.color === maximizingColor ? 1 : -1

    score += AI_PIECE_VALUES[piece.type] * direction

    if (piece.type !== 'king' && CENTER_SQUARES.has(piece.square)) {
      score += SEARCH_CENTER_CONTROL_BONUS * direction
    }

    if (piece.type === 'pawn') {
      score += evaluatePawnAdvancement(piece.square, piece.color) * direction
    }
  }

  if (game.status === 'check') {
    score += game.checkedColor === maximizingColor
      ? -SEARCH_CHECK_BONUS
      : SEARCH_CHECK_BONUS
  }

  return score
}

function evaluatePawnAdvancement(
  square: ChessSquare,
  color: PieceColor,
): number {
  const rankIndex = Number(square[1])

  return color === 'white'
    ? (rankIndex - 2) * SEARCH_PAWN_ADVANCEMENT_BONUS
    : (7 - rankIndex) * SEARCH_PAWN_ADVANCEMENT_BONUS
}

function orderMovesForSearch(legalMoves: LegalMove[]): LegalMove[] {
  return rankEasyMoves(legalMoves).map((entry) => entry.move)
}

function applyMove(game: ChessGameState, move: LegalMove): ChessGameState {
  return makeMove(game, {
    from: move.from,
    to: move.to,
    ...(move.promotion === null ? {} : { promotion: move.promotion }),
  })
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
