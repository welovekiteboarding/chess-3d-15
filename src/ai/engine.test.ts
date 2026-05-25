import { describe, expect, it } from 'vitest'

import { createChessGame, generateLegalMoves } from '../chess/engine'
import { selectAiMove } from './engine'
import { requestAiMove } from '../workers/chessAi'
import type { ChessGameOptions, ChessGameState, ChessPiecePlacement } from '../types/chess'
import type { AiDifficulty, AiMoveSelection } from '../types/ai'

const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard']

function createCustomGame(
  pieces: ChessPiecePlacement[],
  options: Omit<ChessGameOptions, 'pieces'> = {},
): ChessGameState {
  return createChessGame({
    pieces,
    ...options,
  })
}

function isLegalSelectedMove(
  game: ChessGameState,
  selection: AiMoveSelection,
): boolean {
  return generateLegalMoves(game).some(
    (move) =>
      move.from === selection.move.from &&
      move.to === selection.move.to &&
      move.promotion === (selection.move.promotion ?? null),
  )
}

describe('selectAiMove', () => {
  it('returns a legal move for every difficulty from a valid non-terminal position', () => {
    const game = createChessGame()

    for (const difficulty of DIFFICULTIES) {
      const selection = selectAiMove({
        game,
        difficulty,
        seed: 17,
      })

      expect(selection.difficulty).toBe(difficulty)
      expect(isLegalSelectedMove(game, selection)).toBe(true)
    }
  })

  it('makes easy mode deterministic when given a seed', () => {
    const game = createCustomGame([
      { square: 'a1', color: 'white', type: 'king' },
      { square: 'd4', color: 'white', type: 'knight' },
      { square: 'h8', color: 'black', type: 'king' },
    ])

    const first = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 7,
    })
    const second = selectAiMove({
      game,
      difficulty: 'easy',
      seed: 7,
    })

    expect(first.move).toEqual(second.move)
    expect(first.algorithm).toBe('rule-based')
    expect(first.searchDepth).toBe(1)
  })

  it('uses search-backed strategies for medium and hard modes', () => {
    const game = createCustomGame([
      { square: 'e1', color: 'white', type: 'king' },
      { square: 'd1', color: 'white', type: 'rook' },
      { square: 'h8', color: 'black', type: 'king' },
      { square: 'd8', color: 'black', type: 'queen' },
    ])

    const medium = selectAiMove({
      game,
      difficulty: 'medium',
      seed: 21,
    })
    const hard = selectAiMove({
      game,
      difficulty: 'hard',
      seed: 21,
    })

    expect(medium.move).toMatchObject({
      from: 'd1',
      to: 'd8',
    })
    expect(medium.algorithm).toBe('minimax')
    expect(medium.searchDepth).toBeGreaterThan(1)

    expect(hard.move).toMatchObject({
      from: 'd1',
      to: 'd8',
    })
    expect(hard.algorithm).toBe('alpha-beta')
    expect(hard.searchDepth).toBeGreaterThan(medium.searchDepth)
    expect(hard.nodesEvaluated).toBeGreaterThan(0)
  })
})

describe('requestAiMove', () => {
  it('supports async move selection without requiring a browser worker in tests', async () => {
    const game = createChessGame()
    const selection = await requestAiMove(
      {
        game,
        difficulty: 'hard',
        seed: 29,
      },
      { useWorker: false },
    )

    expect(isLegalSelectedMove(game, selection)).toBe(true)
  })
})
