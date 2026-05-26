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
