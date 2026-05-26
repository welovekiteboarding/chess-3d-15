import {
  applySearchMove,
  createSearchPosition,
  generateLegalMoves,
  generateSearchLegalMovesFromPosition,
  isSearchPositionInCheck,
} from '../chess/engine'
import type { ChessSearchPosition } from '../chess/engine'
import type {
  AiDifficulty,
  AiMoveRequest,
  AiMoveSelector,
  AiPieceValues,
  AiSearchDiagnostics,
  AiSearchOptions,
  AiScoredMove,
} from '../types/ai'
import {
  CHESS_FILES,
  CHESS_RANKS,
} from '../types/chess'
import type {
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
const SEARCH_CHECKMATE_SCORE = 1_000_000
const AI_SEARCH_POSITION_BUDGETS = {
  medium: 3_000,
  hard: 12_000,
} as const
const CENTER_SQUARES = new Set<ChessSquare>(['d4', 'd5', 'e4', 'e5'])
type SearchCacheBound = 'exact' | 'lower' | 'upper'

interface SearchCacheEntry {
  depth: number
  score: number
  bound: SearchCacheBound
}

interface SearchCacheLookup {
  alpha: number
  beta: number
  score?: number
}

interface SearchContext {
  maximizingColor: PieceColor
  useAlphaBeta: boolean
  maxPositions: number | null
  positionsEvaluated: number
  alphaBetaCutoffs: number
  cacheHits: number
  terminatedEarly: boolean
  diagnostics?: AiSearchDiagnostics
  transpositionTable: Map<string, SearchCacheEntry>
}

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

  return normalizeLegalSelection(
    AI_MOVE_SELECTORS[request.difficulty](request, legalMoves),
    legalMoves,
  )
}

export function createAiSearchDiagnostics(): AiSearchDiagnostics {
  return {
    positionsEvaluated: 0,
    alphaBetaCutoffs: 0,
    cacheHits: 0,
    terminatedEarly: false,
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
    .sort(compareScoredMoves)
}

export function searchBestMove(
  request: AiMoveRequest,
  options: AiSearchOptions,
): LegalMove {
  const legalMoves = generateLegalMoves(request.game)

  if (legalMoves.length === 0) {
    throw new Error('AI cannot select a move from a terminal position')
  }

  return normalizeLegalSelection(
    selectSearchMove(request, legalMoves, options),
    legalMoves,
  )
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
    maxPositions: AI_SEARCH_POSITION_BUDGETS.medium,
  })
}

function selectHardMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
): LegalMove {
  return selectSearchMove(request, legalMoves, {
    depth: AI_SEARCH_DEPTHS.hard,
    alphaBetaPruning: true,
    maxPositions: AI_SEARCH_POSITION_BUDGETS.hard,
  })
}

function selectSearchMove(
  request: AiMoveRequest,
  legalMoves: LegalMove[],
  options: AiSearchOptions,
): LegalMove {
  const random = request.random ?? Math.random
  const orderedMoves = orderMovesForSearch(legalMoves)
  const searchPosition = createSearchPosition(request.game)
  const bestMoves: LegalMove[] = []
  const depth = normalizeSearchDepth(options.depth)
  const useAlphaBeta = options.alphaBetaPruning ?? false
  const context = createSearchContext(request, options, useAlphaBeta)
  let bestScore = Number.NEGATIVE_INFINITY
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    if (context.terminatedEarly && bestMoves.length > 0) {
      break
    }

    const nextGame = applyMove(searchPosition, move)
    const score = minimax(
      nextGame,
      depth - 1,
      alpha,
      beta,
      context,
    )

    if (score > bestScore) {
      bestScore = score
      bestMoves.length = 0
      bestMoves.push(move)
    } else if (score === bestScore) {
      bestMoves.push(move)
    }

    if (context.useAlphaBeta) {
      alpha = Math.max(alpha, bestScore)
    }
  }

  return pickRandomMove(bestMoves, random)
}

function minimax(
  game: ChessSearchPosition,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  const cacheKey = createSearchCacheKey(game, context.maximizingColor)
  const cachedResult = readCachedScore(cacheKey, depth, alpha, beta, context)

  if (cachedResult !== undefined) {
    if (cachedResult.score !== undefined) {
      return cachedResult.score
    }

    alpha = cachedResult.alpha
    beta = cachedResult.beta
  }

  if (shouldTerminateSearch(context)) {
    return evaluateBoard(
      game,
      context.maximizingColor,
      isSearchPositionInCheck(game, game.turn) ? game.turn : null,
    )
  }

  recordPositionEvaluation(context)
  const checkedColor = isSearchPositionInCheck(game, game.turn)
    ? game.turn
    : null
  const legalMoves = generateSearchLegalMovesFromPosition(game)

  if (legalMoves.length === 0) {
    return storeSearchScore(
      cacheKey,
      depth,
      context,
      evaluateTerminalPosition(
        game.turn,
        context.maximizingColor,
        depth,
        checkedColor !== null,
      ),
      'exact',
    )
  }

  if (depth === 0) {
    return storeSearchScore(
      cacheKey,
      depth,
      context,
      evaluateBoard(game, context.maximizingColor, checkedColor),
      'exact',
    )
  }

  const orderedMoves = orderMovesForSearch(legalMoves)
  const alphaStart = alpha
  const betaStart = beta

  if (game.turn === context.maximizingColor) {
    let bestScore = Number.NEGATIVE_INFINITY

    for (const move of orderedMoves) {
      const score = minimax(
        applyMove(game, move),
        depth - 1,
        alpha,
        beta,
        context,
      )
      bestScore = Math.max(bestScore, score)

      if (context.useAlphaBeta) {
        alpha = Math.max(alpha, bestScore)

        if (alpha >= beta) {
          context.alphaBetaCutoffs += 1
          syncDiagnostics(context)
          return bestScore
        }
      }

      if (context.terminatedEarly) {
        break
      }
    }

    return storeSearchResult(
      cacheKey,
      depth,
      context,
      bestScore,
      alphaStart,
      betaStart,
    )
  }

  let bestScore = Number.POSITIVE_INFINITY

  for (const move of orderedMoves) {
    const score = minimax(
      applyMove(game, move),
      depth - 1,
      alpha,
      beta,
      context,
    )
    bestScore = Math.min(bestScore, score)

    if (context.useAlphaBeta) {
      beta = Math.min(beta, bestScore)

      if (alpha >= beta) {
        context.alphaBetaCutoffs += 1
        syncDiagnostics(context)
        return bestScore
      }
    }

    if (context.terminatedEarly) {
      break
    }
  }

  return storeSearchResult(
    cacheKey,
    depth,
    context,
    bestScore,
    alphaStart,
    betaStart,
  )
}

function evaluateTerminalPosition(
  turn: PieceColor,
  maximizingColor: PieceColor,
  depth: number,
  inCheck: boolean,
): number {
  if (!inCheck) {
    return 0
  }

  return turn === maximizingColor
    ? -SEARCH_CHECKMATE_SCORE - depth
    : SEARCH_CHECKMATE_SCORE + depth
}

function evaluateBoard(
  game: ChessSearchPosition,
  maximizingColor: PieceColor,
  checkedColor: PieceColor | null,
): number {
  let score = 0

  forEachSearchPiece(game, (square, piece) => {
    const direction = piece.color === maximizingColor ? 1 : -1

    score += AI_PIECE_VALUES[piece.type] * direction

    if (piece.type !== 'king' && CENTER_SQUARES.has(square)) {
      score += SEARCH_CENTER_CONTROL_BONUS * direction
    }

    if (piece.type === 'pawn') {
      score += evaluatePawnAdvancement(square, piece.color) * direction
    }
  })

  if (checkedColor !== null) {
    score += checkedColor === maximizingColor
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

function compareScoredMoves(left: AiScoredMove, right: AiScoredMove): number {
  return right.score - left.score || compareLegalMoves(left.move, right.move)
}

function applyMove(
  game: ChessSearchPosition,
  move: LegalMove,
): ChessSearchPosition {
  return applySearchMove(game, move)
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

function createSearchContext(
  request: AiMoveRequest,
  options: AiSearchOptions,
  useAlphaBeta: boolean,
): SearchContext {
  // Hard and medium search stay synchronous in this layer, so we cap the
  // amount of evaluated work rather than risking long main-thread stalls.
  return {
    maximizingColor: request.game.turn,
    useAlphaBeta,
    maxPositions: normalizeMaxPositions(options.maxPositions),
    positionsEvaluated: 0,
    alphaBetaCutoffs: 0,
    cacheHits: 0,
    terminatedEarly: false,
    diagnostics: options.diagnostics,
    transpositionTable: new Map<string, SearchCacheEntry>(),
  }
}

function normalizeSearchDepth(depth: number): number {
  if (!Number.isFinite(depth)) {
    return 1
  }

  return Math.max(1, Math.floor(depth))
}

function normalizeMaxPositions(value: number | undefined): number | null {
  if (value === undefined) {
    return null
  }

  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }

  return Math.floor(value)
}

function shouldTerminateSearch(context: SearchContext): boolean {
  if (context.maxPositions === null || context.positionsEvaluated < context.maxPositions) {
    return false
  }

  context.terminatedEarly = true
  syncDiagnostics(context)

  return true
}

function recordPositionEvaluation(context: SearchContext): void {
  context.positionsEvaluated += 1
  syncDiagnostics(context)
}

function readCachedScore(
  cacheKey: string,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): SearchCacheLookup | undefined {
  const cachedScore = context.transpositionTable.get(cacheKey)

  if (cachedScore === undefined || cachedScore.depth < depth) {
    return undefined
  }

  context.cacheHits += 1
  syncDiagnostics(context)

  if (cachedScore.bound === 'exact') {
    return { alpha, beta, score: cachedScore.score }
  }

  const nextAlpha =
    cachedScore.bound === 'lower'
      ? Math.max(alpha, cachedScore.score)
      : alpha
  const nextBeta =
    cachedScore.bound === 'upper'
      ? Math.min(beta, cachedScore.score)
      : beta

  if (nextAlpha >= nextBeta) {
    return {
      alpha: nextAlpha,
      beta: nextBeta,
      score: cachedScore.score,
    }
  }

  return {
    alpha: nextAlpha,
    beta: nextBeta,
  }
}

function storeSearchScore(
  cacheKey: string,
  depth: number,
  context: SearchContext,
  score: number,
  bound: SearchCacheBound,
): number {
  if (!context.terminatedEarly) {
    context.transpositionTable.set(cacheKey, {
      depth,
      score,
      bound,
    })
  }

  return score
}

function storeSearchResult(
  cacheKey: string,
  depth: number,
  context: SearchContext,
  score: number,
  alpha: number,
  beta: number,
): number {
  if (context.terminatedEarly) {
    return score
  }

  if (score <= alpha) {
    return storeSearchScore(cacheKey, depth, context, score, 'upper')
  }

  if (score >= beta) {
    return storeSearchScore(cacheKey, depth, context, score, 'lower')
  }

  return storeSearchScore(cacheKey, depth, context, score, 'exact')
}

function syncDiagnostics(context: SearchContext): void {
  if (context.diagnostics === undefined) {
    return
  }

  context.diagnostics.positionsEvaluated = context.positionsEvaluated
  context.diagnostics.alphaBetaCutoffs = context.alphaBetaCutoffs
  context.diagnostics.cacheHits = context.cacheHits
  context.diagnostics.terminatedEarly = context.terminatedEarly
}

function normalizeLegalSelection(
  move: LegalMove,
  legalMoves: LegalMove[],
): LegalMove {
  const matchingMove = legalMoves.find(
    (candidate) => compareLegalMoves(candidate, move) === 0,
  )

  return matchingMove ?? legalMoves[0]!
}

function compareLegalMoves(left: LegalMove, right: LegalMove): number {
  return createMoveKey(left).localeCompare(createMoveKey(right))
}

function createMoveKey(move: LegalMove): string {
  return `${move.from}-${move.to}-${move.promotion ?? 'none'}`
}

function createSearchCacheKey(
  game: ChessSearchPosition,
  maximizingColor: PieceColor,
): string {
  const castlingRights = `${Number(game.castlingRights.white.kingSide)}${Number(game.castlingRights.white.queenSide)}${Number(game.castlingRights.black.kingSide)}${Number(game.castlingRights.black.queenSide)}`
  const pieces: string[] = []

  forEachSearchPiece(game, (square, piece) => {
    pieces.push(`${piece.color[0]}${toPieceTypeCode(piece.type)}${square}`)
  })

  return [
    maximizingColor,
    game.turn,
    castlingRights,
    game.enPassantTarget ?? '-',
    pieces.join(','),
  ].join('|')
}

function forEachSearchPiece(
  game: ChessSearchPosition,
  visit: (square: ChessSquare, piece: LegalMove['piece']) => void,
): void {
  for (const rank of CHESS_RANKS) {
    for (const file of CHESS_FILES) {
      const square = `${file}${rank}` as ChessSquare
      const piece = game.board[square]

      if (piece !== undefined) {
        visit(square, piece)
      }
    }
  }
}

function toPieceTypeCode(type: LegalMove['piece']['type']): string {
  switch (type) {
    case 'king':
      return 'k'
    case 'queen':
      return 'q'
    case 'rook':
      return 'r'
    case 'bishop':
      return 'b'
    case 'knight':
      return 'n'
    case 'pawn':
      return 'p'
  }
}
