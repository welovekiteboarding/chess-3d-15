import { describe, expect, it } from 'vitest'

import { createChessGame, makeMove } from '../chess/engine'
import type {
  ChessGameOptions,
  ChessGameState,
  ChessPiecePlacement,
  MoveInput,
} from '../types/chess'
import { requestChessHint } from './hint'

function createCustomGame(
  pieces: ChessPiecePlacement[],
  options: Omit<ChessGameOptions, 'pieces'> = {},
): ChessGameState {
  return createChessGame({
    pieces,
    ...options,
  })
}

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

describe('requestChessHint', () => {
  it('returns the recommended source and destination squares for the side to move', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    expect(
      requestChessHint({
        game,
        difficulty: 'easy',
        random: () => 0,
      }),
    ).toEqual({
      from: 'd4',
      to: 'd7',
      promotion: null,
    })
  })

  it('returns null when the current position is terminal', () => {
    const game = playMoves(createChessGame(), [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])

    expect(requestChessHint({ game })).toBeNull()
  })
})
