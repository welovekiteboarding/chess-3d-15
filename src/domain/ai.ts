import { generateLegalMoves, makeMove } from '../chess/engine'
import type {
  AiMoveAnalysis,
  AiMoveRequest,
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
const MATERIAL_SCORE_SCALE = 100
const CHECK_STATE_BONUS = 25
const MEDIUM_SEARCH_DEPTH = 2
const HARD_SEARCH_DEPTH = 3
const CHECKMATE_SCORE = 1_000_000
const MAX_RANDOM_VALUE = 0.999_999
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

interface SearchStats {
  nodesVisited: number
  prunedBranches: number
}

interface SearchCandidate {
  move: LegalMove
  score: number
}

function toMoveInput(move: LegalMove): MoveInput {
  return move.promotion === null
    ? {
        from: move.from,
        to: move.to,
      }
    : {
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      }
}

export const AI_PIECE_VALUES: AiPieceValues = {
  king: 0,
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
}

export function selectAiMove(request: AiMoveRequest): LegalMove {
  return analyzeAiMove(request).move
}

export function analyzeAiMove(request: AiMoveRequest): AiMoveAnalysis {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  if (request.difficulty === 'easy') {
    const move = selectEasyMove(request, legalMoves)

    return {
      move,
      score: scoreEasyMove(move),
      searchDepth: 0,
      nodesVisited: legalMoves.length,
      prunedBranches: 0,
    }
  }

  const searchDepth =
    request.difficulty === 'medium' ? MEDIUM_SEARCH_DEPTH : HARD_SEARCH_DEPTH
  const useAlphaBeta = request.difficulty === 'hard'

  return selectStrategicMove(request, legalMoves, searchDepth, useAlphaBeta)
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

function selectStrategicMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  searchDepth: number,
  useAlphaBeta: boolean,
): AiMoveAnalysis {
  const stats: SearchStats = {
    nodesVisited: 0,
    prunedBranches: 0,
  }
  const perspective = request.game.turn
  const candidates: SearchCandidate[] = orderMovesForSearch(legalMoves).map(
    (move) => ({
      move,
      score: searchPosition(
        makeMove(request.game, toMoveInput(move)),
        perspective,
        searchDepth - 1,
        useAlphaBeta,
        -Infinity,
        Infinity,
        stats,
      ),
    }),
  )
  const highestScore = Math.max(...candidates.map((candidate) => candidate.score))
  const bestMoves = candidates
    .filter((candidate) => candidate.score === highestScore)
    .map((candidate) => candidate.move)
  const move = pickBestScoredMove(bestMoves, request.random ?? Math.random)

  return {
    move,
    score: highestScore,
    searchDepth,
    nodesVisited: stats.nodesVisited,
    prunedBranches: stats.prunedBranches,
  }
}

function searchPosition(
  game: ChessGameState,
  perspective: PieceColor,
  depth: number,
  useAlphaBeta: boolean,
  alpha: number,
  beta: number,
  stats: SearchStats,
): number {
  stats.nodesVisited += 1

  if (
    depth === 0 ||
    game.status === 'checkmate' ||
    game.status === 'stalemate'
  ) {
    return evaluateBoard(game, perspective)
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    return evaluateBoard(game, perspective)
  }

  const maximizing = game.turn === perspective
  const orderedMoves = orderMovesForSearch(legalMoves)
  let bestScore = maximizing ? -Infinity : Infinity

  for (let index = 0; index < orderedMoves.length; index += 1) {
    const move = orderedMoves[index]!
    const score = searchPosition(
      makeMove(game, toMoveInput(move)),
      perspective,
      depth - 1,
      useAlphaBeta,
      alpha,
      beta,
      stats,
    )

    if (maximizing) {
      bestScore = Math.max(bestScore, score)
      alpha = Math.max(alpha, bestScore)
    } else {
      bestScore = Math.min(bestScore, score)
      beta = Math.min(beta, bestScore)
    }

    if (useAlphaBeta && alpha >= beta) {
      stats.prunedBranches += orderedMoves.length - index - 1
      break
    }
  }

  return bestScore
}

function evaluateBoard(game: ChessGameState, perspective: PieceColor): number {
  if (game.status === 'checkmate') {
    return game.winner === perspective ? CHECKMATE_SCORE : -CHECKMATE_SCORE
  }

  if (game.status === 'stalemate') {
    return 0
  }

  let score = 0

  for (const placement of game.pieces) {
    const direction = placement.color === perspective ? 1 : -1
    score += AI_PIECE_VALUES[placement.type] * MATERIAL_SCORE_SCALE * direction
  }

  if (game.status === 'check') {
    score +=
      game.checkedColor === perspective
        ? -CHECK_STATE_BONUS
        : CHECK_STATE_BONUS
  }

  return score
}

function orderMovesForSearch(legalMoves: LegalMove[]): LegalMove[] {
  return rankEasyMoves(legalMoves).map((entry) => entry.move)
}

function pickBestScoredMove(
  moves: LegalMove[],
  random: () => number,
): LegalMove {
  const rankedMoves = rankEasyMoves(moves)
  const highestScore = rankedMoves[0]!.score
  const bestMoves = rankedMoves
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.move)

  return pickRandomMove(bestMoves, random)
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
