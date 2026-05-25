import { describe, expect, it } from 'vitest'

import {
  AI_SEARCH_DEPTHS,
  createAiSearchDiagnostics,
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

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
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

  it('uses the provided random source to break ties deterministically', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'knight' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )

    const firstMove = selectAiMove({
      game,
      difficulty: 'easy',
      random: createSeededRandom(17),
    })
    const secondMove = selectAiMove({
      game,
      difficulty: 'easy',
      random: createSeededRandom(17),
    })

    expect(moveKey(firstMove)).toBe(moveKey(secondMove))
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

  it('caps hard-search work on the starting position and still returns a legal move', () => {
    const game = createChessGame()
    const diagnostics = createAiSearchDiagnostics()
    const legalMoveKeys = new Set(generateLegalMoves(game).map(moveKey))

    const searchedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        random: () => 0,
      },
      {
        depth: AI_SEARCH_DEPTHS.hard,
        alphaBetaPruning: true,
        diagnostics,
        positionBudget: 64,
      },
    )

    expect(legalMoveKeys.has(moveKey(searchedMove))).toBe(true)
    expect(diagnostics.completedDepth).toBeGreaterThan(0)
    expect(diagnostics.searchAborted).toBe(true)
    expect(diagnostics.positionsEvaluated).toBeLessThanOrEqual(64)
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
