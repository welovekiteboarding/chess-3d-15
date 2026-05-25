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
import type {
  CastlingRights,
  ChessGameState,
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
const SEARCH_CHECK_BONUS = 0.5
const SEARCH_CENTER_CONTROL_BONUS = 0.15
const SEARCH_PAWN_ADVANCEMENT_BONUS = 0.05
const SEARCH_BISHOP_PAIR_BONUS = 0.3
const SEARCH_CASTLING_RIGHTS_BONUS = 0.1
const SEARCH_CHECKMATE_SCORE = 1_000_000
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])

export const AI_SEARCH_DEPTHS = {
  medium: 2,
  hard: 4,
} as const

export const AI_SEARCH_POSITION_BUDGETS = {
  medium: 1_500,
  hard: 12_000,
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

interface SearchContext {
  aborted: boolean
  diagnostics?: AiSearchDiagnostics
  positionBudget: number | null
  transpositionTable: Map<string, TranspositionEntry>
}

interface SearchResult {
  completed: boolean
  score: number
}

interface RootSearchResult {
  bestMoves: LegalMove[]
  completed: boolean
}

interface TranspositionEntry {
  depth: number
  score: number
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
    transpositionHits: 0,
    completedDepth: 0,
    aborted: false,
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
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return compareMoveKeys(left.move, right.move)
    })
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
  return pickRandomMove(getTopRankedMoves(legalMoves), resolveRandomSource(request))
}

function selectMediumMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.medium,
    positionBudget: AI_SEARCH_POSITION_BUDGETS.medium,
  })
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.hard,
    alphaBetaPruning: true,
    positionBudget: AI_SEARCH_POSITION_BUDGETS.hard,
  })
}

function selectSearchMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  options: AiSearchOptions,
): LegalMove {
  const random = resolveRandomSource(request)
  const orderedMoves = orderMovesForSearch(legalMoves)
  const fallbackMoves = getTopRankedMoves(legalMoves)
  const targetDepth = normalizeSearchDepth(options.depth)
  const diagnostics = options.diagnostics
  const context = createSearchContext(options.positionBudget, diagnostics)
  let selectedMoves = fallbackMoves

  for (let depth = 1; depth <= targetDepth; depth += 1) {
    const result = searchAtDepth(
      request.game,
      orderedMoves,
      depth,
      request.game.turn,
      options.alphaBetaPruning ?? false,
      context,
    )

    if (result.bestMoves.length > 0) {
      selectedMoves = result.bestMoves
    }

    if (!result.completed) {
      break
    }

    if (diagnostics !== undefined) {
      diagnostics.completedDepth = depth
    }
  }

  if (diagnostics !== undefined) {
    diagnostics.aborted = context.aborted
  }

  return pickRandomMove(selectedMoves, random)
}

function createSearchContext(
  positionBudget: number | undefined,
  diagnostics?: AiSearchDiagnostics,
): SearchContext {
  resetDiagnostics(diagnostics)

  return {
    aborted: false,
    diagnostics,
    positionBudget: normalizePositionBudget(positionBudget),
    transpositionTable: new Map<string, TranspositionEntry>(),
  }
}

function resetDiagnostics(diagnostics?: AiSearchDiagnostics): void {
  if (diagnostics === undefined) {
    return
  }

  diagnostics.positionsEvaluated = 0
  diagnostics.alphaBetaCutoffs = 0
  diagnostics.transpositionHits = 0
  diagnostics.completedDepth = 0
  diagnostics.aborted = false
}

function searchAtDepth(
  game: ChessGameState,
  orderedMoves: LegalMove[],
  depth: number,
  maximizingColor: PieceColor,
  useAlphaBeta: boolean,
  context: SearchContext,
): RootSearchResult {
  const bestMoves: LegalMove[] = []
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY
  let completed = true

  for (const move of orderedMoves) {
    const result = minimax(
      applyMove(game, move),
      depth - 1,
      maximizingColor,
      useAlphaBeta,
      alpha,
      beta,
      context,
    )

    if (bestMoves.length === 0 || result.score > bestScore) {
      bestScore = result.score
      bestMoves.length = 0
      bestMoves.push(move)
    } else if (result.score === bestScore) {
      bestMoves.push(move)
    }

    if (!result.completed) {
      completed = false
    }

    if (context.aborted) {
      break
    }

    if (useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }
  }

  return {
    bestMoves,
    completed: completed && !context.aborted,
  }
}

function minimax(
  game: ChessGameState,
  depth: number,
  maximizingColor: PieceColor,
  useAlphaBeta: boolean,
  alpha: number,
  beta: number,
  context: SearchContext,
): SearchResult {
  if (!tryEnterNode(context)) {
    return {
      score: evaluateBoard(game, maximizingColor, depth),
      completed: false,
    }
  }

  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate') {
    return {
      score: evaluateBoard(game, maximizingColor, depth),
      completed: true,
    }
  }

  const cacheKey = serializeGameState(game)
  const cached = context.transpositionTable.get(cacheKey)

  if (cached !== undefined && cached.depth >= depth) {
    if (context.diagnostics !== undefined) {
      context.diagnostics.transpositionHits += 1
    }

    return {
      score: cached.score,
      completed: true,
    }
  }

  const legalMoves = generateLegalMoves(game)

  if (legalMoves.length === 0) {
    return {
      score: evaluateBoard(game, maximizingColor, depth),
      completed: true,
    }
  }

  const orderedMoves = orderMovesForSearch(legalMoves)
  const maximizingTurn = game.turn === maximizingColor
  let bestScore = maximizingTurn
    ? Number.NEGATIVE_INFINITY
    : Number.POSITIVE_INFINITY
  let completed = true
  let cutOff = false

  for (const move of orderedMoves) {
    const result = minimax(
      applyMove(game, move),
      depth - 1,
      maximizingColor,
      useAlphaBeta,
      alpha,
      beta,
      context,
    )

    if (maximizingTurn) {
      bestScore = Math.max(bestScore, result.score)
    } else {
      bestScore = Math.min(bestScore, result.score)
    }

    if (!result.completed) {
      completed = false
    }

    if (context.aborted) {
      break
    }

    if (!useAlphaBeta) {
      continue
    }

    if (maximizingTurn) {
      alpha = Math.max(alpha, bestScore)
    } else {
      beta = Math.min(beta, bestScore)
    }

    if (alpha >= beta) {
      if (context.diagnostics !== undefined) {
        context.diagnostics.alphaBetaCutoffs += 1
      }
      cutOff = true
      break
    }
  }

  if (completed && !context.aborted && !cutOff) {
    context.transpositionTable.set(cacheKey, {
      depth,
      score: bestScore,
    })
  }

  return {
    score: bestScore,
    completed: completed && !context.aborted,
  }
}

function tryEnterNode(context: SearchContext): boolean {
  if (context.positionBudget !== null && context.positionBudget <= 0) {
    context.aborted = true
    return false
  }

  if (context.diagnostics !== undefined) {
    context.diagnostics.positionsEvaluated += 1
  }

  if (context.positionBudget !== null) {
    context.positionBudget -= 1
  }

  return true
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
  let maximizingBishops = 0
  let minimizingBishops = 0

  for (const piece of game.pieces) {
    const direction = piece.color === maximizingColor ? 1 : -1

    score += AI_PIECE_VALUES[piece.type] * direction

    if (piece.type !== 'king' && CENTER_SQUARES.has(piece.square)) {
      score += SEARCH_CENTER_CONTROL_BONUS * direction
    }

    if (piece.type === 'pawn') {
      score += evaluatePawnAdvancement(piece.square, piece.color) * direction
    }

    if (piece.type === 'bishop') {
      if (piece.color === maximizingColor) {
        maximizingBishops += 1
      } else {
        minimizingBishops += 1
      }
    }
  }

  if (maximizingBishops >= 2) {
    score += SEARCH_BISHOP_PAIR_BONUS
  }

  if (minimizingBishops >= 2) {
    score -= SEARCH_BISHOP_PAIR_BONUS
  }

  score += evaluateCastlingRights(game, maximizingColor)

  if (game.status === 'check') {
    score += game.checkedColor === maximizingColor
      ? -SEARCH_CHECK_BONUS
      : SEARCH_CHECK_BONUS
  }

  return score
}

function evaluateCastlingRights(
  game: ChessGameState,
  maximizingColor: PieceColor,
): number {
  const maximizingRights = game.castlingRights[maximizingColor]
  const minimizingRights = game.castlingRights[
    maximizingColor === 'white' ? 'black' : 'white'
  ]

  return (
    scoreCastlingRights(maximizingRights) -
    scoreCastlingRights(minimizingRights)
  )
}

function scoreCastlingRights(rights: CastlingRights): number {
  let score = 0

  if (rights.kingSide) {
    score += SEARCH_CASTLING_RIGHTS_BONUS
  }

  if (rights.queenSide) {
    score += SEARCH_CASTLING_RIGHTS_BONUS
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

function getTopRankedMoves(legalMoves: LegalMove[]): LegalMove[] {
  const rankedMoves = rankEasyMoves(legalMoves)
  const highestScore = rankedMoves[0]!.score

  return rankedMoves
    .filter((entry) => entry.score === highestScore)
    .map((entry) => entry.move)
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

function resolveRandomSource(request: AiMoveRequest): () => number {
  if (request.random !== undefined) {
    return request.random
  }

  if (request.seed !== undefined) {
    return createSeededRandom(request.seed)
  }

  return Math.random
}

function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? seed : 0) >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function normalizeSearchDepth(depth: number): number {
  if (!Number.isFinite(depth)) {
    return 1
  }

  return Math.max(1, Math.floor(depth))
}

function normalizePositionBudget(positionBudget: number | undefined): number | null {
  if (positionBudget === undefined || !Number.isFinite(positionBudget)) {
    return null
  }

  return Math.max(0, Math.floor(positionBudget))
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

function compareMoveKeys(left: LegalMove, right: LegalMove): number {
  return moveKey(left).localeCompare(moveKey(right))
}

function moveKey(move: LegalMove): string {
  return `${move.from}-${move.to}-${move.promotion ?? 'none'}`
}

function serializeGameState(game: ChessGameState): string {
  const pieces = [...game.pieces]
    .sort((left, right) => left.square.localeCompare(right.square))
    .map((piece) => `${piece.color}:${piece.type}:${piece.square}`)
    .join('|')

  return [
    game.turn,
    `${Number(game.castlingRights.white.kingSide)}${Number(game.castlingRights.white.queenSide)}`,
    `${Number(game.castlingRights.black.kingSide)}${Number(game.castlingRights.black.queenSide)}`,
    game.enPassantTarget ?? '-',
    pieces,
  ].join(':')
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
