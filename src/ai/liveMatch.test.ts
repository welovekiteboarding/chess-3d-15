import { describe, expect, it } from 'vitest'

import { createChessGame, makeMove } from '../chess/engine'
import { createChessAiMatchSettings } from './gameMode'
import {
  createChessAiRandomSeed,
  isChessAiControlledTurn,
} from './liveMatch'

describe('isChessAiControlledTurn', () => {
  it('hands Black turns to the AI in human-vs-ai mode', () => {
    const settings = createChessAiMatchSettings({
      mode: 'human-vs-ai',
    })
    const gameAfterHumanMove = makeMove(createChessGame(), {
      from: 'e2',
      to: 'e4',
    })

    expect(isChessAiControlledTurn(settings, createChessGame())).toBe(false)
    expect(isChessAiControlledTurn(settings, gameAfterHumanMove)).toBe(true)
    expect(
      isChessAiControlledTurn(createChessAiMatchSettings(), gameAfterHumanMove),
    ).toBe(false)
  })

  it('stops scheduling AI turns in terminal positions', () => {
    const settings = createChessAiMatchSettings({
      mode: 'human-vs-ai',
    })
    const stalemate = createChessGame({
      pieces: [
        { square: 'f7', color: 'white', type: 'king' },
        { square: 'g6', color: 'white', type: 'queen' },
        { square: 'h8', color: 'black', type: 'king' },
      ],
      turn: 'black',
    })

    expect(isChessAiControlledTurn(settings, stalemate)).toBe(false)
  })

  it('derives AI turn ownership from the board position when status metadata is stale', () => {
    const settings = createChessAiMatchSettings({
      mode: 'human-vs-ai',
    })
    const playableAiTurn = makeMove(createChessGame(), {
      from: 'e2',
      to: 'e4',
    })
    const staleDrawGame = {
      ...playableAiTurn,
      status: 'draw' as const,
      checkedColor: null,
      winner: null,
    }
    const checkmate = makeMove(
      makeMove(
        makeMove(
          makeMove(createChessGame(), {
            from: 'f2',
            to: 'f3',
          }),
          {
            from: 'e7',
            to: 'e5',
          },
        ),
        {
          from: 'g2',
          to: 'g4',
        },
      ),
      {
        from: 'd8',
        to: 'h4',
      },
    )
    const staleActiveCheckmate = {
      ...checkmate,
      status: 'active' as const,
      checkedColor: null,
      winner: null,
    }

    expect(isChessAiControlledTurn(settings, staleDrawGame)).toBe(true)
    expect(isChessAiControlledTurn(settings, staleActiveCheckmate)).toBe(false)
  })
})

describe('createChessAiRandomSeed', () => {
  it('returns the same seed for the same position and a different seed after a move', () => {
    const initialGame = createChessGame()
    const nextGame = makeMove(initialGame, {
      from: 'e2',
      to: 'e4',
    })

    expect(createChessAiRandomSeed(initialGame)).toBe(
      createChessAiRandomSeed(createChessGame()),
    )
    expect(createChessAiRandomSeed(initialGame)).not.toBe(
      createChessAiRandomSeed(nextGame),
    )
  })
})
