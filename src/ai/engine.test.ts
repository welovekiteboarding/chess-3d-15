import { describe, expect, it } from 'vitest'

import {
  AI_SEARCH_CONFIG,
  evaluateBoard,
  scoreEasyMove,
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
        { square: 'e4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'e8', color: 'black', type: 'queen' },
        { square: 'e7', color: 'black', type: 'rook' },
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

    expect(easyMove.from).toBe('e4')
    expect(easyMove.to).toBe('e7')
    expect(mediumMove.from).toBe('e4')
    expect(mediumMove.to).not.toBe('e7')
  })
})

describe('AI_SEARCH_CONFIG', () => {
  it('uses deeper alpha-beta search for hard mode than medium mode', () => {
    expect(AI_SEARCH_CONFIG.medium).toEqual({
      depth: 2,
      useAlphaBeta: false,
    })
    expect(AI_SEARCH_CONFIG.hard).toEqual({
      depth: 3,
      useAlphaBeta: true,
    })
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

describe('evaluateBoard', () => {
  it('scores material from the requested side perspective', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )

    expect(evaluateBoard(game, 'white')).toBeGreaterThan(0)
    expect(evaluateBoard(game, 'black')).toBeLessThan(0)
  })
})
