import { describe, expect, it } from 'vitest'

import {
  evaluateBoard,
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
      const game = createCustomGame(
        [
          { square: 'g1', color: 'white', type: 'king' },
          { square: 'd4', color: 'white', type: 'queen' },
          { square: 'a1', color: 'white', type: 'rook' },
          { square: 'g8', color: 'black', type: 'king' },
          { square: 'd7', color: 'black', type: 'rook' },
        ],
        { turn: 'white' },
      )
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
        { square: 'd8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
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

  it('matches the deeper hard-mode search result', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'a1', color: 'white', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    const hardMove = selectAiMove({
      game,
      difficulty: 'hard',
      random: () => 0,
    })
    const prunedSearch = searchBestMove(game, {
      depth: 3,
      alphaBeta: true,
      random: () => 0,
    })

    expect(moveKey(hardMove)).toBe(moveKey(prunedSearch.move))
  })

  it('prunes search branches without changing the selected line', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd1', color: 'white', type: 'queen' },
        { square: 'a1', color: 'white', type: 'rook' },
        { square: 'c4', color: 'white', type: 'bishop' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd8', color: 'black', type: 'rook' },
        { square: 'f8', color: 'black', type: 'rook' },
        { square: 'g7', color: 'black', type: 'pawn' },
        { square: 'h7', color: 'black', type: 'pawn' },
      ],
      { turn: 'white' },
    )

    const prunedSearch = searchBestMove(game, {
      depth: 2,
      alphaBeta: true,
      random: () => 0,
    })
    const unprunedSearch = searchBestMove(game, {
      depth: 2,
      alphaBeta: false,
      random: () => 0,
    })

    expect(moveKey(prunedSearch.move)).toBe(moveKey(unprunedSearch.move))
    expect(prunedSearch.score).toBe(unprunedSearch.score)
    expect(prunedSearch.nodesEvaluated).toBeLessThan(
      unprunedSearch.nodesEvaluated,
    )
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
  it('scores material advantage from the requested side perspective', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
      ],
      { turn: 'white' },
    )

    expect(evaluateBoard(game, 'white')).toBeGreaterThan(0)
    expect(evaluateBoard(game, 'black')).toBeLessThan(0)
  })
})
