import { describe, expect, it } from 'vitest'

import { analyzeAiMove, scoreEasyMove, selectAiMove } from '../domain/ai'
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

  it('lets medium avoid a hanging queen capture that easy still takes', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
        { square: 'h3', color: 'black', type: 'bishop' },
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
})

describe('analyzeAiMove', () => {
  it('uses deeper alpha-beta search for hard mode than for medium mode', () => {
    const game = createChessGame()

    const mediumAnalysis = analyzeAiMove({
      game,
      difficulty: 'medium',
      random: () => 0,
    })
    const hardAnalysis = analyzeAiMove({
      game,
      difficulty: 'hard',
      random: () => 0,
    })

    expect(hardAnalysis.searchDepth).toBeGreaterThan(mediumAnalysis.searchDepth)
    expect(hardAnalysis.prunedBranches).toBeGreaterThan(0)
    expect(hardAnalysis.nodesVisited).toBeGreaterThan(0)
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
