import { describe, expect, it } from 'vitest'

import { createChessGame, generateLegalMoves, makeMove } from '../chess/engine'
import type {
  ChessGameOptions,
  ChessGameState,
  ChessPiecePlacement,
  MoveInput,
} from '../types/chess'
import {
  createChessHintState,
  dismissChessHintState,
  requestChessHint,
  showChessHintState,
  syncChessHintState,
} from './hint'

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

  it('always returns a legal move from the current position', () => {
    const game = createChessGame()
    const hint = requestChessHint({
      game,
      difficulty: 'hard',
      random: () => 0,
    })

    expect(hint).not.toBeNull()
    expect(
      generateLegalMoves(game).some(
        (move) =>
          move.from === hint!.from &&
          move.to === hint!.to &&
          move.promotion === hint!.promotion,
      ),
    ).toBe(true)
  })

  it('updates the recommendation when the board state changes', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const initialHint = requestChessHint({
      game,
      difficulty: 'easy',
      random: () => 0,
    })
    const nextGame = makeMove(game, { from: 'd4', to: 'd5' })
    const nextHint = requestChessHint({
      game: nextGame,
      difficulty: 'easy',
      random: () => 0,
    })

    expect(initialHint).toEqual({
      from: 'd4',
      to: 'd7',
      promotion: null,
    })
    expect(nextHint).toEqual({
      from: 'd7',
      to: 'd5',
      promotion: null,
    })
  })

  it('shows a visible hint without changing the current game state', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const originalGame = structuredClone(game)

    expect(
      showChessHintState({
        game,
        difficulty: 'easy',
        random: () => 0,
      }),
    ).toEqual({
      isVisible: true,
      hint: {
        from: 'd4',
        to: 'd7',
        promotion: null,
      },
    })
    expect(game).toEqual(originalGame)
  })

  it('can dismiss a visible hint after the next move', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const visibleHint = showChessHintState({
      game,
      difficulty: 'easy',
      random: () => 0,
    })
    const nextGame = makeMove(game, { from: 'd4', to: 'd5' })

    expect(
      syncChessHintState({
        state: visibleHint,
        game: nextGame,
        behavior: 'dismiss',
        difficulty: 'easy',
        random: () => 0,
      }),
    ).toEqual(createChessHintState())
  })

  it('keeps a dismissed hint hidden when the board state changes', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const nextGame = makeMove(game, { from: 'd4', to: 'd5' })
    const dismissedHint = dismissChessHintState()

    expect(
      syncChessHintState({
        state: dismissedHint,
        game: nextGame,
        behavior: 'replace',
        difficulty: 'easy',
        random: () => 0,
      }),
    ).toEqual(dismissedHint)
  })

  it('can replace a visible hint with the next recommended move after the board changes', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const visibleHint = showChessHintState({
      game,
      difficulty: 'easy',
      random: () => 0,
    })
    const nextGame = makeMove(game, { from: 'd4', to: 'd5' })

    expect(
      syncChessHintState({
        state: visibleHint,
        game: nextGame,
        behavior: 'replace',
        difficulty: 'easy',
        random: () => 0,
      }),
    ).toEqual({
      isVisible: true,
      hint: {
        from: 'd7',
        to: 'd5',
        promotion: null,
      },
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

  it('returns null when no legal move exists even if the status metadata is stale', () => {
    const checkmateGame = playMoves(createChessGame(), [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])
    const staleStatusGame: ChessGameState = {
      ...checkmateGame,
      status: 'active',
      checkedColor: null,
      winner: null,
    }

    expect(requestChessHint({ game: staleStatusGame })).toBeNull()
  })
})
