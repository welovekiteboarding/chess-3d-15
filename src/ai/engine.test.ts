import { describe, expect, it } from 'vitest'

import {
  AI_SEARCH_DEPTHS,
  createAiSearchDiagnostics,
  scoreEasyMove,
  searchBestMove,
  selectAiMove,
} from './engine'
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

  it.each<AiDifficulty>(['easy', 'medium', 'hard'])(
    'repeats the same move for %s mode when the seed is fixed',
    (difficulty) => {
      const game = createChessGame()
      const firstSelection = selectAiMove({
        game,
        difficulty,
        seed: 2_024,
      })
      const repeatedSelection = selectAiMove({
        game,
        difficulty,
        seed: 2_024,
      })

      expect(moveKey(repeatedSelection)).toBe(moveKey(firstSelection))
    },
  )

  it('uses a deterministic seed to break ties between equally scored moves', () => {
    const game = createCustomGame(
      [
        { square: 'a1', color: 'white', type: 'knight' },
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )

    const firstSelection = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 12_345,
    })
    const repeatedSelection = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 12_345,
    })
    const alternateSelection = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 98_765,
    })

    expect(moveKey(repeatedSelection)).toBe(moveKey(firstSelection))
    expect(moveKey(alternateSelection)).not.toBe(moveKey(firstSelection))
  })

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

  it('returns a legal move even when a search budget stops deeper analysis early', () => {
    const game = createChessGame()
    const diagnostics = createAiSearchDiagnostics()
    const searchedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        seed: 11,
      },
      {
        depth: AI_SEARCH_DEPTHS.hard,
        alphaBetaPruning: true,
        maxPositions: 64,
        diagnostics,
      },
    )

    expect(new Set(generateLegalMoves(game).map(moveKey)).has(moveKey(searchedMove))).toBe(true)
    expect(diagnostics.positionsEvaluated).toBeLessThanOrEqual(64)
    expect(diagnostics.budgetExhausted).toBe(true)
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
})
