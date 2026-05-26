import { describe, expect, it } from 'vitest'

import {
  AI_SEARCH_DEPTHS,
  createAiSearchDiagnostics,
  rankEasyMoves,
  scoreEasyMove,
  searchBestMove,
  selectAiMove,
} from '../domain/ai'
import { createChessGame, generateLegalMoves } from '../chess/engine'
import type { AiDifficulty } from '../types/ai'
import type {
  ChessGameOptions,
  ChessGameState,
  ChessPiecePlacement,
  LegalMove,
} from '../types/chess'

function createCustomGame(
  pieces: ChessPiecePlacement[],
  options: Omit<ChessGameOptions, 'pieces'> = {},
): ChessGameState {
  return createChessGame({
    pieces,
    ...options,
  })
}

function moveKey(move: LegalMove): string {
  return `${move.from}-${move.to}-${move.promotion ?? 'none'}`
}

describe('selectAiMove', () => {
  it.each<AiDifficulty>(['easy', 'medium', 'hard'])(
    'returns a legal move for %s mode',
    (difficulty) => {
      const game = createChessGame()
      const legalMoveKeys = new Set(generateLegalMoves(game).map(moveKey))
      const selectedMove = selectAiMove({
        game,
        difficulty,
        random: () => 0,
      })

      expect(legalMoveKeys.has(moveKey(selectedMove))).toBe(true)
    },
  )

  it('uses the easy heuristic to choose an obvious rook capture', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    const selectedMove = selectAiMove({
      game,
      difficulty: 'easy',
      random: () => 0,
    })

    expect(selectedMove.from).toBe('d4')
    expect(selectedMove.to).toBe('d7')
    expect(selectedMove.isCapture).toBe(true)
  })

  it('uses shallow search in medium mode to avoid a poisoned rook capture', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
        { square: 'e6', color: 'black', type: 'bishop' },
      ],
      { turn: 'white' },
    )

    const easyMove = selectAiMove({
      game,
      difficulty: 'easy',
      random: () => 0,
    })
    const mediumMove = selectAiMove({
      game,
      difficulty: 'medium',
      random: () => 0,
    })

    expect(moveKey(easyMove)).toBe('d4-d7-none')
    expect(moveKey(mediumMove)).not.toBe('d4-d7-none')
  })

  it('uses a deeper alpha-beta search for hard mode', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
        { square: 'e6', color: 'black', type: 'bishop' },
      ],
      { turn: 'white' },
    )
    const diagnostics = createAiSearchDiagnostics()
    const request = {
      game,
      difficulty: 'hard' as const,
      random: () => 0,
    }

    const searchedMove = searchBestMove(request, {
      depth: AI_SEARCH_DEPTHS.hard,
      alphaBetaPruning: true,
      diagnostics,
    })

    expect(AI_SEARCH_DEPTHS.hard).toBeGreaterThan(AI_SEARCH_DEPTHS.medium)
    expect(new Set(generateLegalMoves(game).map(moveKey)).has(moveKey(searchedMove))).toBe(true)
    expect(diagnostics.positionsEvaluated).toBeGreaterThan(0)
    expect(diagnostics.alphaBetaCutoffs).toBeGreaterThan(0)
  })

  it('stops search at the configured position budget and still returns a legal move', () => {
    const game = createChessGame()
    const diagnostics = createAiSearchDiagnostics()
    const searchedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: 4,
        alphaBetaPruning: true,
        diagnostics,
        maxPositions: 25,
      },
    )

    expect(new Set(generateLegalMoves(game).map(moveKey)).has(moveKey(searchedMove))).toBe(true)
    expect(diagnostics.positionsEvaluated).toBeLessThanOrEqual(25)
    expect(diagnostics.terminatedEarly).toBe(true)
  })

  it('reuses cached positions when different move orders reach the same search state', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'a1', color: 'white', type: 'rook' },
        { square: 'h1', color: 'white', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )
    const diagnostics = createAiSearchDiagnostics()

    searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: 3,
        diagnostics,
      },
    )

    expect(diagnostics.cacheHits).toBeGreaterThan(0)
  })

  it('reuses cached positions during hard-mode alpha-beta search', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'a1', color: 'white', type: 'rook' },
        { square: 'h1', color: 'white', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )
    const diagnostics = createAiSearchDiagnostics()

    searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: AI_SEARCH_DEPTHS.hard,
        alphaBetaPruning: true,
        diagnostics,
      },
    )

    expect(diagnostics.cacheHits).toBeGreaterThan(0)
  })

  it('returns the same hard-mode move for the same seeded random input', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'a1', color: 'white', type: 'rook' },
        { square: 'h1', color: 'white', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )
    const request = {
      game,
      difficulty: 'hard' as const,
      random: () => 0.75,
    }

    const firstMove = selectAiMove(request)
    const secondMove = selectAiMove(request)

    expect(moveKey(firstMove)).toBe(moveKey(secondMove))
  })

  it('falls back to the deepest completed search depth when the next depth hits its budget', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
        { square: 'e6', color: 'black', type: 'bishop' },
      ],
      { turn: 'white' },
    )
    const completedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: AI_SEARCH_DEPTHS.medium,
        alphaBetaPruning: true,
      },
    )
    const budgetedDiagnostics = createAiSearchDiagnostics()
    const budgetedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: AI_SEARCH_DEPTHS.hard,
        alphaBetaPruning: true,
        diagnostics: budgetedDiagnostics,
        maxPositions: 300,
      },
    )

    expect(moveKey(budgetedMove)).toBe(moveKey(completedMove))
    expect(budgetedDiagnostics.terminatedEarly).toBe(true)
  })
})

describe('scoreEasyMove', () => {
  it('values an available rook capture above a quiet queen move', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    const queenMoves = generateLegalMoves(game, 'd4')
    const rookCapture = queenMoves.find((move) => move.to === 'd7')
    const quietMove = queenMoves.find((move) => move.to === 'd3')

    expect(rookCapture).toBeDefined()
    expect(quietMove).toBeDefined()
    expect(scoreEasyMove(rookCapture!)).toBeGreaterThan(scoreEasyMove(quietMove!))
  })

  it('orders equal-scoring moves deterministically regardless of input order', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )

    const queenMoves = generateLegalMoves(game, 'd4')
    const leftMove = queenMoves.find((move) => move.to === 'b2')
    const rightMove = queenMoves.find((move) => move.to === 'd3')

    expect(leftMove).toBeDefined()
    expect(rightMove).toBeDefined()

    const forwardOrder = rankEasyMoves([leftMove!, rightMove!]).map(
      (entry) => moveKey(entry.move),
    )
    const reverseOrder = rankEasyMoves([rightMove!, leftMove!]).map(
      (entry) => moveKey(entry.move),
    )

    expect(forwardOrder).toEqual(reverseOrder)
  })
})
