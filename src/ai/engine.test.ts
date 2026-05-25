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

  it('uses the provided seed to deterministically break ties', () => {
    const game = createChessGame()
    const rankedMoves = generateLegalMoves(game)
      .map((move) => ({
        move,
        score: scoreEasyMove(move),
      }))
      .sort((left, right) => right.score - left.score)
    const highestScore = rankedMoves[0]!.score
    const tiedBestMoves = rankedMoves.filter((entry) => entry.score === highestScore)

    expect(tiedBestMoves.length).toBeGreaterThan(1)

    const selectedMoveA = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 7,
    })
    const selectedMoveB = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 7,
    })

    expect(moveKey(selectedMoveA)).toBe(moveKey(selectedMoveB))
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

  it('returns a legal move even when a deeper search hits its position budget', () => {
    const game = createChessGame()
    const diagnostics = createAiSearchDiagnostics()
    const selectedMove = searchBestMove(
      {
        game,
        difficulty: 'hard',
        seed: 13,
      },
      {
        depth: AI_SEARCH_DEPTHS.hard,
        alphaBetaPruning: true,
        positionBudget: 1,
        diagnostics,
      },
    )

    expect(new Set(generateLegalMoves(game).map(moveKey)).has(moveKey(selectedMove))).toBe(true)
    expect(diagnostics.aborted).toBe(true)
    expect(diagnostics.completedDepth).toBeLessThan(AI_SEARCH_DEPTHS.hard)
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
