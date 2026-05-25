import { generateLegalMoves, makeMove } from '../chess/engine'
import type {
  AiDifficulty,
  AiMoveRequest,
  AiMoveSelector,
  AiPieceValues,
  AiScoredMove,
} from '../types/ai'
import type {
  ChessGameState,
  ChessPositionSnapshot,
  ChessSquare,
  LegalMove,
  PieceColor,
} from '../types/chess'

const EASY_CAPTURE_WEIGHT = 100
const EASY_CHECKMATE_BONUS = 100_000
const EASY_CHECK_BONUS = 50
const EASY_CASTLING_BONUS = 20
const EASY_CENTER_BONUS = 10
const EASY_DEVELOPMENT_BONUS = 6
const EASY_QUIET_KING_PENALTY = 10
const MAX_RANDOM_VALUE = 0.999_999
const POSITION_CHECKMATE_SCORE = 1_000_000
const POSITION_CHECK_BONUS = 35
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

export const AI_PIECE_VALUES: AiPieceValues = {
  king: 0,
  queen: 9,
  rook: 5,
  bishop: 3,
  knight: 3,
  pawn: 1,
}

interface AiSearchConfig {
  depth: number
  useAlphaBeta: boolean
}

export const AI_SEARCH_CONFIG: Record<'medium' | 'hard', AiSearchConfig> = {
  medium: {
    depth: 2,
    useAlphaBeta: false,
  },
  hard: {
    depth: 3,
    useAlphaBeta: true,
  },
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

function selectEasyMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  const bestMoves = getTopRankedMoves(rankEasyMoves(legalMoves))

  return pickRandomMove(bestMoves, request.random ?? Math.random)
}

function selectMediumMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectStrategicMove(request, legalMoves, AI_SEARCH_CONFIG.medium)
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectStrategicMove(request, legalMoves, AI_SEARCH_CONFIG.hard)
}

function selectStrategicMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  config: AiSearchConfig,
): LegalMove {
  const random = request.random ?? Math.random
  const maximizingColor = request.game.turn
  const orderedMoves = orderMovesForSearch(legalMoves)
  const scoredMoves: AiScoredMove[] = []
  let alpha = Number.NEGATIVE_INFINITY

  for (const move of orderedMoves) {
    const score = evaluateSearchMove(
      move,
      request.game,
      config,
      maximizingColor,
      alpha,
      Number.POSITIVE_INFINITY,
    )

    scoredMoves.push({
      move,
      score,
    })

    if (config.useAlphaBeta) {
      alpha = Math.max(alpha, score)
    }
  }

  const bestMoves = getTopRankedMoves(scoredMoves)

  return pickRandomMove(bestMoves, random)
}

export function evaluateBoard(
  game: ChessPositionSnapshot,
  perspective: PieceColor,
): number {
  if (game.status === 'checkmate') {
    if (game.winner === perspective) {
      return POSITION_CHECKMATE_SCORE
    }

    return -POSITION_CHECKMATE_SCORE
  }

  if (game.status === 'stalemate') {
    return 0
  }

  const materialScore = game.pieces.reduce((score, piece) => {
    const pieceValue = AI_PIECE_VALUES[piece.type] * EASY_CAPTURE_WEIGHT

    return score + (piece.color === perspective ? pieceValue : -pieceValue)
  }, 0)

  if (game.checkedColor === null) {
    return materialScore
  }

  return (
    materialScore +
    (game.checkedColor === perspective
      ? -POSITION_CHECK_BONUS
      : POSITION_CHECK_BONUS)
  )
}

function evaluateSearchMove(
  move: LegalMove,
  game: ChessGameState,
  config: AiSearchConfig,
  maximizingColor: PieceColor,
  alpha: number,
  beta: number,
): number {
  const nextGame = projectMove(game, move)

  return searchPosition(
    nextGame,
    Math.max(config.depth - 1, 0),
    maximizingColor,
    alpha,
    beta,
    config.useAlphaBeta,
  )
}

function searchPosition(
  game: ChessGameState,
  depth: number,
  maximizingColor: PieceColor,
  alpha: number,
  beta: number,
  useAlphaBeta: boolean,
): number {
  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate') {
    return scorePosition(game, maximizingColor, depth)
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    return scorePosition(game, maximizingColor, depth)
  }

  if (game.turn === maximizingColor) {
    let bestScore = Number.NEGATIVE_INFINITY

    for (const move of orderMovesForSearch(legalMoves)) {
      const score = searchPosition(
        projectMove(game, move),
        depth - 1,
        maximizingColor,
        alpha,
        beta,
        useAlphaBeta,
      )

      bestScore = Math.max(bestScore, score)

      if (useAlphaBeta) {
        alpha = Math.max(alpha, bestScore)

        if (alpha >= beta) {
          break
        }
      }
    }

    return bestScore
  }

  let bestScore = Number.POSITIVE_INFINITY

  for (const move of orderMovesForSearch(legalMoves)) {
    const score = searchPosition(
      projectMove(game, move),
      depth - 1,
      maximizingColor,
      alpha,
      beta,
      useAlphaBeta,
    )

    bestScore = Math.min(bestScore, score)

    if (useAlphaBeta) {
      beta = Math.min(beta, bestScore)

      if (beta <= alpha) {
        break
      }
    }
  }

  return bestScore
}

function scorePosition(
  game: ChessGameState,
  maximizingColor: PieceColor,
  depth: number,
): number {
  const score = evaluateBoard(game, maximizingColor)

  if (Math.abs(score) !== POSITION_CHECKMATE_SCORE) {
    return score
  }

  return score > 0 ? score + depth : score - depth
}

function orderMovesForSearch(legalMoves: LegalMove[]): LegalMove[] {
  return rankEasyMoves(legalMoves).map((entry) => entry.move)
}

function getTopRankedMoves(rankedMoves: AiScoredMove[]): LegalMove[] {
  const highestScore = rankedMoves.reduce(
    (bestScore, entry) => Math.max(bestScore, entry.score),
    Number.NEGATIVE_INFINITY,
  )

  return rankedMoves
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.move)
}

function projectMove(game: ChessGameState, move: LegalMove): ChessGameState {
  return makeMove(
    {
      ...game,
      history: [],
    },
    {
      from: move.from,
      to: move.to,
      ...(move.promotion === null ? {} : { promotion: move.promotion }),
    },
  )
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

function isBackRank(square: ChessSquare, color: LegalMove['piece']['color']): boolean {
  return square[1] === (color === 'white' ? '1' : '8')
}
