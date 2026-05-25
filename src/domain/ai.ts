import { applyLegalMove, generateLegalMoves } from '../chess/engine'
import { squareToCoordinates } from './chessboard'
import type {
  AiAsyncOptions,
  AiAsyncSearchOptions,
  AiDifficulty,
  AiMoveRequest,
  AiMoveSelector,
  AiPieceValues,
  AiSearchDiagnostics,
  AiSearchOptions,
  AiScoredMove,
} from '../types/ai'
import type {
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
const RANDOM_MODULUS = 0x1_0000_0000
const RANDOM_MULTIPLIER = 1_664_525
const RANDOM_INCREMENT = 1_013_904_223
const SEARCH_CHECK_BONUS = 0.5
const SEARCH_CENTER_CONTROL_BONUS = 0.15
const SEARCH_MINOR_PIECE_ACTIVITY_BONUS = 0.08
const SEARCH_MAJOR_PIECE_ACTIVITY_BONUS = 0.04
const SEARCH_PAWN_ADVANCEMENT_BONUS = 0.05
const SEARCH_CHECKMATE_SCORE = 1_000_000
const SEARCH_CHECK_THREAT_BONUS = 4
const SEARCH_PROMOTION_THREAT_BONUS = 3
const SEARCH_CAPTURE_ORDER_WEIGHT = 12
const SEARCH_ATTACKER_RISK_WEIGHT = 2
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

interface SearchContext {
  maximizingColor: PieceColor
  useAlphaBeta: boolean
  random: () => number
  maxPositions: number
  positionsEvaluated: number
  diagnostics?: AiSearchDiagnostics
  transpositionTable: Map<string, number>
  budgetExhausted: boolean
}

interface AsyncSearchContext extends SearchContext {
  yieldAfterPositions: number
  scheduler: () => Promise<void>
  positionsAtLastYield: number
}

interface RootSearchResult {
  scoredMoves: AiScoredMove[]
  completed: boolean
}

const DEFAULT_ASYNC_YIELD_AFTER_POSITIONS = 64

export const AI_SEARCH_DEPTHS = {
  medium: 2,
  hard: 3,
} as const

export const AI_SEARCH_POSITION_BUDGETS = {
  medium: 1_500,
  hard: 2_000,
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

  const selectedMove = AI_MOVE_SELECTORS[request.difficulty](request, legalMoves)

  return ensureLegalMove(selectedMove, legalMoves)
}

export async function selectAiMoveAsync(
  request: AiMoveRequest,
  options: AiAsyncOptions = {},
): Promise<LegalMove> {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  switch (request.difficulty) {
    case 'easy':
      return ensureLegalMove(selectEasyMove(request, legalMoves), legalMoves)
    case 'medium':
      return ensureLegalMove(
        await selectSearchMoveAsync(request, legalMoves, {
          depth: AI_SEARCH_DEPTHS.medium,
          maxPositions: request.maxPositions ?? AI_SEARCH_POSITION_BUDGETS.medium,
          ...options,
        }),
        legalMoves,
      )
    case 'hard':
      return ensureLegalMove(
        await selectSearchMoveAsync(request, legalMoves, {
          depth: AI_SEARCH_DEPTHS.hard,
          alphaBetaPruning: true,
          maxPositions: request.maxPositions ?? AI_SEARCH_POSITION_BUDGETS.hard,
          ...options,
        }),
        legalMoves,
      )
  }
}

export function createAiSearchDiagnostics(): AiSearchDiagnostics {
  return {
    positionsEvaluated: 0,
    alphaBetaCutoffs: 0,
    cacheHits: 0,
    budgetExhausted: false,
    completedDepth: 0,
  }
}

export function createSeededRandom(seed: number): () => number {
  let state = normalizeSeed(seed)

  return () => {
    state = (Math.imul(state, RANDOM_MULTIPLIER) + RANDOM_INCREMENT) >>> 0
    return state / RANDOM_MODULUS
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

  return ensureLegalMove(selectSearchMove(request, legalMoves, options), legalMoves)
}

export async function searchBestMoveAsync(
  request: AiMoveRequest,
  options: AiAsyncSearchOptions,
): Promise<LegalMove> {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  return ensureLegalMove(
    await selectSearchMoveAsync(request, legalMoves, options),
    legalMoves,
  )
}

function selectEasyMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  const rankedMoves = rankEasyMoves(legalMoves)
  const bestMoves = collectTopMoves(rankedMoves)

  return pickRandomMove(bestMoves, resolveRandom(request))
}

function selectMediumMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.medium,
    maxPositions: request.maxPositions ?? AI_SEARCH_POSITION_BUDGETS.medium,
  })
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.hard,
    alphaBetaPruning: true,
    maxPositions: request.maxPositions ?? AI_SEARCH_POSITION_BUDGETS.hard,
  })
}

function selectSearchMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  options: AiSearchOptions,
): LegalMove {
  const context = createSearchContext(request, options)
  const fallbackMoves = collectTopMoves(rankEasyMoves(legalMoves))
  let bestMoves = fallbackMoves
  let orderedMoves = orderMovesForSearch(legalMoves)

  for (let depth = 1; depth <= Math.max(1, options.depth); depth += 1) {
    const result = searchRoot(request.game, orderedMoves, depth, context)

    if (result.scoredMoves.length > 0) {
      orderedMoves = result.scoredMoves
        .slice()
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.move)
    }

    if (!result.completed) {
      break
    }

    bestMoves = collectTopMoves(result.scoredMoves)

    if (context.diagnostics !== undefined) {
      context.diagnostics.completedDepth = depth
    }
  }

  return pickRandomMove(bestMoves, context.random)
}

async function selectSearchMoveAsync(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  options: AiAsyncSearchOptions,
): Promise<LegalMove> {
  const context = createAsyncSearchContext(request, options)
  const fallbackMoves = collectTopMoves(rankEasyMoves(legalMoves))
  let bestMoves = fallbackMoves
  let orderedMoves = orderMovesForSearch(legalMoves)

  for (let depth = 1; depth <= Math.max(1, options.depth); depth += 1) {
    const result = await searchRootAsync(request.game, orderedMoves, depth, context)

    if (result.scoredMoves.length > 0) {
      orderedMoves = result.scoredMoves
        .slice()
        .sort((left, right) => right.score - left.score)
        .map((entry) => entry.move)
    }

    if (!result.completed) {
      break
    }

    bestMoves = collectTopMoves(result.scoredMoves)

    if (context.diagnostics !== undefined) {
      context.diagnostics.completedDepth = depth
    }

    await maybeYield(context)
  }

  return pickRandomMove(bestMoves, context.random)
}

function searchRoot(
  game: ChessPositionSnapshot,
  legalMoves: LegalMove[],
  depth: number,
  context: SearchContext,
): RootSearchResult {
  const scoredMoves: AiScoredMove[] = []
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY
  let bestScore = Number.NEGATIVE_INFINITY

  for (const move of legalMoves) {
    if (context.budgetExhausted) {
      return {
        scoredMoves,
        completed: false,
      }
    }

    const score = minimax(
      applyMove(game, move),
      depth - 1,
      alpha,
      beta,
      context,
    )

    scoredMoves.push({ move, score })
    bestScore = Math.max(bestScore, score)

    if (context.useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }
  }

  return {
    scoredMoves,
    completed: !context.budgetExhausted,
  }
}

async function searchRootAsync(
  game: ChessPositionSnapshot,
  legalMoves: LegalMove[],
  depth: number,
  context: AsyncSearchContext,
): Promise<RootSearchResult> {
  const scoredMoves: AiScoredMove[] = []
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY
  let bestScore = Number.NEGATIVE_INFINITY

  for (const move of legalMoves) {
    if (context.budgetExhausted) {
      return {
        scoredMoves,
        completed: false,
      }
    }

    const score = await minimaxAsync(
      applyMove(game, move),
      depth - 1,
      alpha,
      beta,
      context,
    )

    scoredMoves.push({ move, score })
    bestScore = Math.max(bestScore, score)

    if (context.useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }

    await maybeYield(context)
  }

  return {
    scoredMoves,
    completed: !context.budgetExhausted,
  }
}

function minimax(
  game: ChessPositionSnapshot,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  const cachedScore = readCachedScore(game, depth, context)

  if (cachedScore !== undefined) {
    return cachedScore
  }

  if (hasReachedSearchBudget(context)) {
    return evaluateBoard(game, context.maximizingColor, depth)
  }

  context.positionsEvaluated += 1

  if (context.diagnostics !== undefined) {
    context.diagnostics.positionsEvaluated += 1
  }

  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate') {
    const terminalScore = evaluateBoard(game, context.maximizingColor, depth)
    writeCachedScore(game, depth, terminalScore, context)
    return terminalScore
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    const score = evaluateBoard(game, context.maximizingColor, depth)
    writeCachedScore(game, depth, score, context)
    return score
  }

  const orderedMoves = orderMovesForSearch(legalMoves)

  if (game.turn === context.maximizingColor) {
    let bestScore = Number.NEGATIVE_INFINITY
    let nextAlpha = alpha

    for (const move of orderedMoves) {
      const score = minimax(
        applyMove(game, move),
        depth - 1,
        nextAlpha,
        beta,
        context,
      )
      bestScore = Math.max(bestScore, score)

      if (context.budgetExhausted) {
        return bestScore
      }

      if (!context.useAlphaBeta) {
        continue
      }

      nextAlpha = Math.max(nextAlpha, bestScore)

      if (nextAlpha >= beta) {
        if (context.diagnostics !== undefined) {
          context.diagnostics.alphaBetaCutoffs += 1
        }
        break
      }
    }

    writeCachedScore(game, depth, bestScore, context)
    return bestScore
  }

  let bestScore = Number.POSITIVE_INFINITY
  let nextBeta = beta

  for (const move of orderedMoves) {
    const score = minimax(
      applyMove(game, move),
      depth - 1,
      alpha,
      nextBeta,
      context,
    )
    bestScore = Math.min(bestScore, score)

    if (context.budgetExhausted) {
      return bestScore
    }

    if (!context.useAlphaBeta) {
      continue
    }

    nextBeta = Math.min(nextBeta, bestScore)

    if (alpha >= nextBeta) {
      if (context.diagnostics !== undefined) {
        context.diagnostics.alphaBetaCutoffs += 1
      }
      break
    }
  }

  writeCachedScore(game, depth, bestScore, context)
  return bestScore
}

async function minimaxAsync(
  game: ChessPositionSnapshot,
  depth: number,
  alpha: number,
  beta: number,
  context: AsyncSearchContext,
): Promise<number> {
  await maybeYield(context)

  const cachedScore = readCachedScore(game, depth, context)

  if (cachedScore !== undefined) {
    return cachedScore
  }

  if (hasReachedSearchBudget(context)) {
    return evaluateBoard(game, context.maximizingColor, depth)
  }

  context.positionsEvaluated += 1

  if (context.diagnostics !== undefined) {
    context.diagnostics.positionsEvaluated += 1
  }

  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate') {
    const terminalScore = evaluateBoard(game, context.maximizingColor, depth)
    writeCachedScore(game, depth, terminalScore, context)
    return terminalScore
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    const score = evaluateBoard(game, context.maximizingColor, depth)
    writeCachedScore(game, depth, score, context)
    return score
  }

  const orderedMoves = orderMovesForSearch(legalMoves)

  if (game.turn === context.maximizingColor) {
    let bestScore = Number.NEGATIVE_INFINITY
    let nextAlpha = alpha

    for (const move of orderedMoves) {
      const score = await minimaxAsync(
        applyMove(game, move),
        depth - 1,
        nextAlpha,
        beta,
        context,
      )
      bestScore = Math.max(bestScore, score)

      if (context.budgetExhausted) {
        return bestScore
      }

      if (!context.useAlphaBeta) {
        continue
      }

      nextAlpha = Math.max(nextAlpha, bestScore)

      if (nextAlpha >= beta) {
        if (context.diagnostics !== undefined) {
          context.diagnostics.alphaBetaCutoffs += 1
        }
        break
      }
    }

    writeCachedScore(game, depth, bestScore, context)
    return bestScore
  }

  let bestScore = Number.POSITIVE_INFINITY
  let nextBeta = beta

  for (const move of orderedMoves) {
    const score = await minimaxAsync(
      applyMove(game, move),
      depth - 1,
      alpha,
      nextBeta,
      context,
    )
    bestScore = Math.min(bestScore, score)

    if (context.budgetExhausted) {
      return bestScore
    }

    if (!context.useAlphaBeta) {
      continue
    }

    nextBeta = Math.min(nextBeta, bestScore)

    if (alpha >= nextBeta) {
      if (context.diagnostics !== undefined) {
        context.diagnostics.alphaBetaCutoffs += 1
      }
      break
    }
  }

  writeCachedScore(game, depth, bestScore, context)
  return bestScore
}

function evaluateBoard(
  game: ChessPositionSnapshot,
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
      continue
    }

    score += evaluatePieceActivity(piece.square, piece.type) * direction
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

function evaluatePieceActivity(
  square: ChessSquare,
  pieceType: LegalMove['piece']['type'],
): number {
  const { fileIndex, rankIndex } = squareToCoordinates(square)
  const fileDistanceFromCenter = Math.abs(3.5 - fileIndex)
  const rankDistanceFromCenter = Math.abs(3.5 - rankIndex)
  const centrality = 1 - (fileDistanceFromCenter + rankDistanceFromCenter) / 7

  switch (pieceType) {
    case 'knight':
    case 'bishop':
      return centrality * SEARCH_MINOR_PIECE_ACTIVITY_BONUS
    case 'rook':
    case 'queen':
      return centrality * SEARCH_MAJOR_PIECE_ACTIVITY_BONUS
    default:
      return 0
  }
}

function orderMovesForSearch(legalMoves: LegalMove[]): LegalMove[] {
  return [...legalMoves].sort(
    (left, right) => scoreSearchMoveOrdering(right) - scoreSearchMoveOrdering(left),
  )
}

function scoreSearchMoveOrdering(move: LegalMove): number {
  let score = scoreEasyMove(move)

  if (move.isCheckmate) {
    score += SEARCH_CHECKMATE_SCORE
  }

  if (move.isCheck) {
    score += SEARCH_CHECK_THREAT_BONUS
  }

  if (move.promotion !== null) {
    score +=
      AI_PIECE_VALUES[move.promotion] * SEARCH_CAPTURE_ORDER_WEIGHT +
      SEARCH_PROMOTION_THREAT_BONUS
  }

  if (move.capturedPiece !== null) {
    score +=
      AI_PIECE_VALUES[move.capturedPiece.type] * SEARCH_CAPTURE_ORDER_WEIGHT -
      AI_PIECE_VALUES[move.piece.type] * SEARCH_ATTACKER_RISK_WEIGHT
  }

  return score
}

function applyMove(
  game: ChessPositionSnapshot,
  move: LegalMove,
): ChessPositionSnapshot {
  return applyLegalMove(game, move)
}

function collectTopMoves(scoredMoves: AiScoredMove[]): LegalMove[] {
  const highestScore = scoredMoves.reduce<number | undefined>(
    (bestScore, entry) =>
      bestScore === undefined ? entry.score : Math.max(bestScore, entry.score),
    undefined,
  )

  if (highestScore === undefined) {
    return []
  }

  return scoredMoves
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.move)
}

function pickRandomMove(moves: LegalMove[], random: () => number): LegalMove {
  const index = Math.min(
    moves.length - 1,
    Math.floor(normalizeRandomValue(random()) * moves.length),
  )

  return moves[index]!
}

function resolveRandom(request: AiMoveRequest): () => number {
  if (request.random !== undefined) {
    return request.random
  }

  if (request.seed !== undefined) {
    return createSeededRandom(request.seed)
  }

  return Math.random
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

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return 0
  }

  return Math.trunc(seed) >>> 0
}

function createSearchContext(
  request: AiMoveRequest,
  options: AiSearchOptions,
): SearchContext {
  const diagnostics = options.diagnostics

  if (diagnostics !== undefined) {
    diagnostics.positionsEvaluated = 0
    diagnostics.alphaBetaCutoffs = 0
    diagnostics.cacheHits = 0
    diagnostics.budgetExhausted = false
    diagnostics.completedDepth = 0
  }

  return {
    maximizingColor: request.game.turn,
    useAlphaBeta: options.alphaBetaPruning ?? false,
    random: resolveRandom(request),
    maxPositions: normalizeMaxPositions(resolveMaxPositions(request, options)),
    positionsEvaluated: 0,
    diagnostics,
    transpositionTable: new Map<string, number>(),
    budgetExhausted: false,
  }
}

function createAsyncSearchContext(
  request: AiMoveRequest,
  options: AiAsyncSearchOptions,
): AsyncSearchContext {
  return {
    ...createSearchContext(request, options),
    yieldAfterPositions: normalizeYieldAfterPositions(options.yieldAfterPositions),
    scheduler: options.scheduler ?? defaultAsyncScheduler,
    positionsAtLastYield: 0,
  }
}

function resolveMaxPositions(
  request: AiMoveRequest,
  options: AiSearchOptions,
): number | undefined {
  if (options.maxPositions !== undefined) {
    return options.maxPositions
  }

  if (request.maxPositions !== undefined) {
    return request.maxPositions
  }

  switch (request.difficulty) {
    case 'medium':
      return AI_SEARCH_POSITION_BUDGETS.medium
    case 'hard':
      return AI_SEARCH_POSITION_BUDGETS.hard
    default:
      return undefined
  }
}

function normalizeMaxPositions(value?: number): number {
  if (value === undefined) {
    return Number.POSITIVE_INFINITY
  }

  if (!Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.max(0, Math.floor(value))
}

function normalizeYieldAfterPositions(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_ASYNC_YIELD_AFTER_POSITIONS
  }

  return Math.max(1, Math.floor(value))
}

function hasReachedSearchBudget(context: SearchContext): boolean {
  if (!Number.isFinite(context.maxPositions)) {
    return false
  }

  if (context.positionsEvaluated < context.maxPositions) {
    return false
  }

  context.budgetExhausted = true

  if (context.diagnostics !== undefined) {
    context.diagnostics.budgetExhausted = true
  }

  return true
}

async function maybeYield(context: AsyncSearchContext): Promise<void> {
  if (
    context.positionsEvaluated === context.positionsAtLastYield ||
    context.positionsEvaluated - context.positionsAtLastYield <
      context.yieldAfterPositions
  ) {
    return
  }

  context.positionsAtLastYield = context.positionsEvaluated
  await context.scheduler()
}

function readCachedScore(
  game: ChessPositionSnapshot,
  depth: number,
  context: SearchContext,
): number | undefined {
  const key = createSearchCacheKey(game, depth, context.maximizingColor)
  const cachedScore = context.transpositionTable.get(key)

  if (cachedScore !== undefined && context.diagnostics !== undefined) {
    context.diagnostics.cacheHits += 1
  }

  return cachedScore
}

function writeCachedScore(
  game: ChessPositionSnapshot,
  depth: number,
  score: number,
  context: SearchContext,
): void {
  if (context.budgetExhausted) {
    return
  }

  context.transpositionTable.set(
    createSearchCacheKey(game, depth, context.maximizingColor),
    score,
  )
}

function createSearchCacheKey(
  game: ChessPositionSnapshot,
  depth: number,
  maximizingColor: PieceColor,
): string {
  const pieceKey = game.pieces
    .map((piece) => `${piece.color[0]}${getPieceCacheCode(piece.type)}${piece.square}`)
    .join('|')

  return [
    maximizingColor,
    depth,
    game.turn,
    game.status,
    game.checkedColor ?? '-',
    game.winner ?? '-',
    game.enPassantTarget ?? '-',
    game.castlingRights.white.kingSide ? 'K' : '-',
    game.castlingRights.white.queenSide ? 'Q' : '-',
    game.castlingRights.black.kingSide ? 'k' : '-',
    game.castlingRights.black.queenSide ? 'q' : '-',
    pieceKey,
  ].join(':')
}

function getPieceCacheCode(pieceType: LegalMove['piece']['type']): string {
  switch (pieceType) {
    case 'king':
      return 'K'
    case 'queen':
      return 'Q'
    case 'rook':
      return 'R'
    case 'bishop':
      return 'B'
    case 'knight':
      return 'N'
    case 'pawn':
      return 'P'
  }
}

function ensureLegalMove(
  selectedMove: LegalMove,
  legalMoves: LegalMove[],
): LegalMove {
  const legalMove = legalMoves.find(
    (move) =>
      move.from === selectedMove.from &&
      move.to === selectedMove.to &&
      move.promotion === selectedMove.promotion,
  )

  return legalMove ?? legalMoves[0]!
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

function defaultAsyncScheduler(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
