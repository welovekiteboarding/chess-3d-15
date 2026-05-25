import { applyLegalMove, generateLegalMoves } from '../chess/engine'
import { squareToCoordinates } from '../domain/chessboard'
import type { AiAlgorithm, AiDifficulty, AiMoveRequest, AiMoveSelection } from '../types/ai'
import type {
  ChessGameState,
  ChessPiecePlacement,
  ChessSquare,
  LegalMove,
  PieceColor,
  PieceType,
} from '../types/chess'

type RandomSource = () => number
type PositionEvaluator = (
  game: ChessGameState,
  maximizingColor: PieceColor,
) => number

interface SearchContext {
  deadline: number
  evaluation: PositionEvaluator
  maximizingColor: PieceColor
  nodesEvaluated: number
  random: RandomSource
  useAlphaBeta: boolean
}

interface SearchOutcome {
  algorithm: AiAlgorithm
  move: LegalMove
  nodesEvaluated: number
  score: number
  searchDepth: number
}

interface ScoredMove {
  move: LegalMove
  score: number
}

const EASY_DEPTH = 1
const MEDIUM_DEPTH = 2
const HARD_DEPTH = 3
const HARD_ENDGAME_DEPTH = 4
const MATE_SCORE = 100_000

const DEFAULT_TIME_BUDGET_MS: Record<AiDifficulty, number> = {
  easy: 12,
  medium: 40,
  hard: 150,
}

const MATERIAL_VALUES: Record<PieceType, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 0,
}

const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])
const EXTENDED_CENTER_SQUARES = new Set<ChessSquare>([
  'c3',
  'c4',
  'c5',
  'c6',
  'd3',
  'd6',
  'e3',
  'e6',
  'f3',
  'f4',
  'f5',
  'f6',
])

const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [0, 0, 0, 0, 0, 0, 0, 0],
] as const

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
] as const

const BISHOP_TABLE = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
] as const

const ROOK_TABLE = [
  [0, 0, 5, 10, 10, 5, 0, 0],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
] as const

const QUEEN_TABLE = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
] as const

const KING_TABLE = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
] as const

const PIECE_SQUARE_TABLES: Record<PieceType, readonly (readonly number[])[]> = {
  pawn: PAWN_TABLE,
  knight: KNIGHT_TABLE,
  bishop: BISHOP_TABLE,
  rook: ROOK_TABLE,
  queen: QUEEN_TABLE,
  king: KING_TABLE,
}

export function selectAiMove(request: AiMoveRequest): AiMoveSelection {
  const startTime = now()
  const result = selectMoveByDifficulty(request)

  return {
    ...result,
    difficulty: request.difficulty,
    durationMs: now() - startTime,
  }
}

function selectMoveByDifficulty(request: AiMoveRequest): SearchOutcome {
  switch (request.difficulty) {
    case 'easy':
      return selectEasyMove(request)
    case 'medium':
      return searchForMove(request, MEDIUM_DEPTH, 'minimax', evaluateBasicPosition)
    case 'hard':
      return searchForMove(
        request,
        resolveHardDepth(request.game),
        'alpha-beta',
        evaluateStrongPosition,
      )
  }
}

function selectEasyMove(request: AiMoveRequest): SearchOutcome {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  const random = createRandomSource(request.seed)
  const scoredMoves = legalMoves
    .map((move) => ({
      move,
      score: scoreEasyMove(move) + random() * 35,
    }))
    .sort(compareScoredMoves)
  const candidateCount = Math.max(1, Math.ceil(scoredMoves.length / 3))
  const chosenIndex = Math.floor(random() * candidateCount)
  const chosenMove = scoredMoves[chosenIndex]

  if (chosenMove === undefined) {
    throw new Error('AI could not rank any legal move')
  }

  return {
    algorithm: 'rule-based',
    move: chosenMove.move,
    nodesEvaluated: legalMoves.length,
    score: chosenMove.score,
    searchDepth: EASY_DEPTH,
  }
}

function searchForMove(
  request: AiMoveRequest,
  searchDepth: number,
  algorithm: AiAlgorithm,
  evaluation: PositionEvaluator,
): SearchOutcome {
  const legalMoves = generateLegalMoves(request.game, undefined, {
    includeOutcome: false,
  })

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  const random = createRandomSource(request.seed)
  const context: SearchContext = {
    deadline: now() + (request.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS[request.difficulty]),
    evaluation,
    maximizingColor: request.game.turn,
    nodesEvaluated: 0,
    random,
    useAlphaBeta: algorithm === 'alpha-beta',
  }

  const orderedMoves = orderMoves(legalMoves, random)
  const bestMoves: ScoredMove[] = []
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY
  let beta = Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    const nextGame = applyLegalMove(request.game, move, {
      recordHistory: false,
    })
    const score = minimax(nextGame, searchDepth - 1, 1, alpha, beta, context)

    if (score > bestScore) {
      bestScore = score
      bestMoves.length = 0
      bestMoves.push({ move, score })
    } else if (score === bestScore) {
      bestMoves.push({ move, score })
    }

    if (context.useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }

    if (hasTimedOut(context) && bestMoves.length > 0) {
      break
    }
  }

  const chosenMove = chooseMove(bestMoves, random)

  return {
    algorithm,
    move: chosenMove.move,
    nodesEvaluated: context.nodesEvaluated,
    score: chosenMove.score,
    searchDepth,
  }
}

function minimax(
  game: ChessGameState,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  if (
    depth === 0 ||
    game.status === 'checkmate' ||
    game.status === 'stalemate' ||
    hasTimedOut(context)
  ) {
    context.nodesEvaluated += 1
    return evaluatePosition(game, context.maximizingColor, ply, context.evaluation)
  }

  const legalMoves = generateLegalMoves(game, undefined, {
    includeOutcome: false,
  })

  if (legalMoves.length === 0) {
    context.nodesEvaluated += 1
    return evaluatePosition(game, context.maximizingColor, ply, context.evaluation)
  }

  const maximizingTurn = game.turn === context.maximizingColor
  const orderedMoves = orderMoves(legalMoves, context.random)
  let bestValue = maximizingTurn
    ? Number.NEGATIVE_INFINITY
    : Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    const nextGame = applyLegalMove(game, move, {
      recordHistory: false,
    })
    const nextValue = minimax(
      nextGame,
      depth - 1,
      ply + 1,
      alpha,
      beta,
      context,
    )

    if (maximizingTurn) {
      bestValue = Math.max(bestValue, nextValue)

      if (context.useAlphaBeta) {
        alpha = Math.max(alpha, bestValue)
      }
    } else {
      bestValue = Math.min(bestValue, nextValue)

      if (context.useAlphaBeta) {
        beta = Math.min(beta, bestValue)
      }
    }

    if ((context.useAlphaBeta && alpha >= beta) || hasTimedOut(context)) {
      break
    }
  }

  return bestValue
}

function evaluatePosition(
  game: ChessGameState,
  maximizingColor: PieceColor,
  ply: number,
  evaluation: PositionEvaluator,
): number {
  if (game.status === 'checkmate') {
    return game.winner === maximizingColor
      ? MATE_SCORE - ply * 10
      : -MATE_SCORE + ply * 10
  }

  if (game.status === 'stalemate') {
    return 0
  }

  let score = evaluation(game, maximizingColor)

  if (game.status === 'check' && game.checkedColor !== null) {
    score += game.checkedColor === maximizingColor ? -30 : 30
  }

  return score
}

function evaluateBasicPosition(
  game: ChessGameState,
  maximizingColor: PieceColor,
): number {
  let score = 0

  for (const piece of game.pieces) {
    const direction = piece.color === maximizingColor ? 1 : -1
    score += direction * MATERIAL_VALUES[piece.type]

    if (piece.type === 'pawn') {
      const { rankIndex } = squareToCoordinates(piece.square)
      const advancement =
        piece.color === 'white' ? rankIndex : 7 - rankIndex

      score += direction * advancement * 6
    }
  }

  return score
}

function evaluateStrongPosition(
  game: ChessGameState,
  maximizingColor: PieceColor,
): number {
  let score = 0
  let whiteBishops = 0
  let blackBishops = 0
  const whitePawns: ChessPiecePlacement[] = []
  const blackPawns: ChessPiecePlacement[] = []

  for (const piece of game.pieces) {
    const direction = piece.color === maximizingColor ? 1 : -1

    score += direction * MATERIAL_VALUES[piece.type]
    score += direction * getPieceSquareValue(piece)

    if (CENTER_SQUARES.has(piece.square)) {
      score += direction * 12
    } else if (EXTENDED_CENTER_SQUARES.has(piece.square)) {
      score += direction * 6
    }

    if (piece.type === 'bishop') {
      if (piece.color === 'white') {
        whiteBishops += 1
      } else {
        blackBishops += 1
      }
    }

    if (piece.type === 'pawn') {
      if (piece.color === 'white') {
        whitePawns.push(piece)
      } else {
        blackPawns.push(piece)
      }
    }
  }

  if (whiteBishops >= 2) {
    score += maximizingColor === 'white' ? 25 : -25
  }

  if (blackBishops >= 2) {
    score += maximizingColor === 'black' ? 25 : -25
  }

  score += evaluatePawnStructure(whitePawns, blackPawns, maximizingColor)
  score += evaluateKingSafety(game, maximizingColor)
  score += evaluateCastlingFlexibility(game, maximizingColor)

  return score
}

function evaluatePawnStructure(
  whitePawns: ChessPiecePlacement[],
  blackPawns: ChessPiecePlacement[],
  maximizingColor: PieceColor,
): number {
  const whiteScore = scorePawnStructureForColor(whitePawns, blackPawns, 'white')
  const blackScore = scorePawnStructureForColor(blackPawns, whitePawns, 'black')

  return maximizingColor === 'white'
    ? whiteScore - blackScore
    : blackScore - whiteScore
}

function scorePawnStructureForColor(
  pawns: ChessPiecePlacement[],
  enemyPawns: ChessPiecePlacement[],
  color: PieceColor,
): number {
  let score = 0
  const pawnsByFile = Array.from({ length: 8 }, () => 0)

  for (const pawn of pawns) {
    const { fileIndex } = squareToCoordinates(pawn.square)
    pawnsByFile[fileIndex] = (pawnsByFile[fileIndex] ?? 0) + 1
  }

  for (const pawn of pawns) {
    const { fileIndex, rankIndex } = squareToCoordinates(pawn.square)
    const sameFileCount = pawnsByFile[fileIndex] ?? 0
    const leftFileCount = pawnsByFile[fileIndex - 1] ?? 0
    const rightFileCount = pawnsByFile[fileIndex + 1] ?? 0
    const advancement = color === 'white' ? rankIndex : 7 - rankIndex

    if (sameFileCount > 1) {
      score -= 10
    }

    if (leftFileCount === 0 && rightFileCount === 0) {
      score -= 8
    }

    if (isPassedPawn(fileIndex, rankIndex, enemyPawns, color)) {
      score += 12 + advancement * 5
    }
  }

  return score
}

function evaluateKingSafety(
  game: ChessGameState,
  maximizingColor: PieceColor,
): number {
  const whiteScore = scoreKingSafetyForColor(game, 'white')
  const blackScore = scoreKingSafetyForColor(game, 'black')

  return maximizingColor === 'white'
    ? whiteScore - blackScore
    : blackScore - whiteScore
}

function scoreKingSafetyForColor(
  game: ChessGameState,
  color: PieceColor,
): number {
  const king = game.pieces.find(
    (piece) => piece.color === color && piece.type === 'king',
  )

  if (king === undefined) {
    return 0
  }

  let score = 0

  if (
    king.square === (color === 'white' ? 'g1' : 'g8') ||
    king.square === (color === 'white' ? 'c1' : 'c8')
  ) {
    score += 25
  }

  const { fileIndex, rankIndex } = squareToCoordinates(king.square)
  const shieldRank = color === 'white' ? rankIndex + 1 : rankIndex - 1

  for (const fileOffset of [-1, 0, 1] as const) {
    const friendlyPawn = game.pieces.find((piece) => {
      if (piece.color !== color || piece.type !== 'pawn') {
        return false
      }

      const coordinates = squareToCoordinates(piece.square)

      return (
        coordinates.fileIndex === fileIndex + fileOffset &&
        coordinates.rankIndex === shieldRank
      )
    })

    if (friendlyPawn !== undefined) {
      score += 6
    }
  }

  return score
}

function evaluateCastlingFlexibility(
  game: ChessGameState,
  maximizingColor: PieceColor,
): number {
  const whiteScore =
    (game.castlingRights.white.kingSide ? 8 : 0) +
    (game.castlingRights.white.queenSide ? 8 : 0)
  const blackScore =
    (game.castlingRights.black.kingSide ? 8 : 0) +
    (game.castlingRights.black.queenSide ? 8 : 0)

  return maximizingColor === 'white'
    ? whiteScore - blackScore
    : blackScore - whiteScore
}

function orderMoves(moves: LegalMove[], random: RandomSource): LegalMove[] {
  return moves
    .map((move) => ({
      move,
      score: scoreMoveOrdering(move) + random() * 0.01,
    }))
    .sort(compareScoredMoves)
    .map((entry) => entry.move)
}

function chooseMove(moves: ScoredMove[], random: RandomSource): ScoredMove {
  const selected = moves[Math.floor(random() * moves.length)]

  if (selected === undefined) {
    throw new Error('AI could not select from the candidate moves')
  }

  return selected
}

function scoreEasyMove(move: LegalMove): number {
  let score = scoreMoveOrdering(move)

  if (move.isCheckmate) {
    score += MATE_SCORE
  } else if (move.isCheck) {
    score += 50
  }

  if (move.isCastling) {
    score += 40
  }

  if (move.piece.type === 'pawn' && !move.isCapture) {
    score += 6
  }

  return score
}

function scoreMoveOrdering(move: LegalMove): number {
  let score = 0

  if (move.capturedPiece !== null) {
    score += MATERIAL_VALUES[move.capturedPiece.type] * 12
    score -= MATERIAL_VALUES[move.piece.type]
  }

  if (move.promotion !== null) {
    score += MATERIAL_VALUES[move.promotion] + 250
  }

  if (CENTER_SQUARES.has(move.to)) {
    score += 24
  } else if (EXTENDED_CENTER_SQUARES.has(move.to)) {
    score += 10
  }

  if (move.isCastling) {
    score += 30
  }

  return score
}

function getPieceSquareValue(piece: ChessPiecePlacement): number {
  const table = PIECE_SQUARE_TABLES[piece.type]
  const { fileIndex, rankIndex } = squareToCoordinates(piece.square)
  const perspectiveRank = piece.color === 'white' ? rankIndex : 7 - rankIndex

  return table[perspectiveRank]?.[fileIndex] ?? 0
}

function isPassedPawn(
  fileIndex: number,
  rankIndex: number,
  enemyPawns: ChessPiecePlacement[],
  color: PieceColor,
): boolean {
  return enemyPawns.every((pawn) => {
    const enemyCoordinates = squareToCoordinates(pawn.square)

    if (Math.abs(enemyCoordinates.fileIndex - fileIndex) > 1) {
      return true
    }

    return color === 'white'
      ? enemyCoordinates.rankIndex <= rankIndex
      : enemyCoordinates.rankIndex >= rankIndex
  })
}

function resolveHardDepth(game: ChessGameState): number {
  const nonKingPieces = game.pieces.filter((piece) => piece.type !== 'king').length

  return nonKingPieces <= 8 ? HARD_ENDGAME_DEPTH : HARD_DEPTH
}

function compareScoredMoves(left: ScoredMove, right: ScoredMove): number {
  if (left.score !== right.score) {
    return right.score - left.score
  }

  return serializeMove(left.move).localeCompare(serializeMove(right.move))
}

function serializeMove(move: LegalMove): string {
  return `${move.from}-${move.to}-${move.promotion ?? 'none'}`
}

function hasTimedOut(context: SearchContext): boolean {
  return now() >= context.deadline
}

function createRandomSource(seed?: number): RandomSource {
  if (seed === undefined) {
    return () => Math.random()
  }

  let state = (seed >>> 0) || 1

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)

    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now()
}
