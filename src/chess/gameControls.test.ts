import { describe, expect, it } from 'vitest'
import { generateLegalMoves, makeMove, createChessGame } from './engine'
import {
  createChessCapturedPiecesBySide,
  createChessGameControlsState,
  createChessMoveHistory,
  resignChessGame,
} from './gameControls'

describe('resignChessGame', () => {
  it('marks the game as resigned, preserves move history, and blocks future moves', () => {
    const game = makeMove(createChessGame(), {
      from: 'e2',
      to: 'e4',
    })

    const resigned = resignChessGame(game)

    expect(resigned.status).toBe('resigned')
    expect(resigned.winner).toBe('white')
    expect(resigned.history).toHaveLength(1)
    expect(generateLegalMoves(resigned)).toEqual([])
    expect(() =>
      makeMove(resigned, {
        from: 'e7',
        to: 'e5',
      }),
    ).toThrow(/game is over/i)
  })

  it('lets callers resign on behalf of the human side during an AI-controlled turn', () => {
    const game = makeMove(createChessGame(), {
      from: 'e2',
      to: 'e4',
    })

    const resigned = resignChessGame(game, 'white')

    expect(resigned.status).toBe('resigned')
    expect(resigned.winner).toBe('black')
  })
})

describe('createChessGameControlsState', () => {
  it('keeps restart available while disabling resign after the game ends', () => {
    const game = resignChessGame(createChessGame())

    expect(createChessGameControlsState(game)).toEqual({
      canRestart: true,
      canResign: false,
      canUndo: false,
    })
  })
})

describe('createChessMoveHistory', () => {
  it('returns readable move labels for the recorded game history', () => {
    const game = [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ].reduce((state, move) => makeMove(state, move), createChessGame())

    expect(createChessMoveHistory(game)).toEqual([
      {
        color: 'white',
        index: 1,
        notation: 'Pawn e2 to e4',
      },
      {
        color: 'black',
        index: 2,
        notation: 'Pawn d7 to d5',
      },
      {
        color: 'white',
        index: 3,
        notation: 'Pawn e4 captures d5',
      },
    ])
  })
})

describe('createChessCapturedPiecesBySide', () => {
  it('groups captured pieces by the side that won them', () => {
    const game = [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ].reduce((state, move) => makeMove(state, move), createChessGame())

    expect(createChessCapturedPiecesBySide(game)).toEqual({
      white: [{ color: 'black', type: 'pawn' }],
      black: [],
    })
  })
})
