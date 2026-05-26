import { describe, expect, it } from 'vitest'
import { createChessGame } from '../chess/engine'
import {
  createChessInteractionState,
  deriveChessInteractionSnapshot,
  selectChessInteractionSquare,
  syncChessInteractionState,
} from './chessInteraction'

describe('chessInteraction', () => {
  it('starts with no selected square or legal targets', () => {
    const game = createChessGame()
    const snapshot = deriveChessInteractionSnapshot(
      game,
      createChessInteractionState(),
    )

    expect(snapshot.selectedSquare).toBeNull()
    expect(snapshot.legalTargets).toEqual([])
  })

  it('selects the active color piece and derives unique legal targets', () => {
    const game = createChessGame({
      pieces: [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
        { square: 'g7', color: 'white', type: 'pawn' },
      ],
    })

    const nextState = selectChessInteractionSquare(
      game,
      createChessInteractionState(),
      'g7',
    )
    const snapshot = deriveChessInteractionSnapshot(game, nextState)

    expect(snapshot.selectedSquare).toBe('g7')
    expect(snapshot.legalTargets).toEqual([
      { square: 'g8', kind: 'move' },
    ])
  })

  it('marks captures distinctly in legal target metadata', () => {
    const game = createChessGame({
      pieces: [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
        { square: 'd4', color: 'white', type: 'bishop' },
        { square: 'f6', color: 'black', type: 'rook' },
      ],
    })

    const nextState = selectChessInteractionSquare(
      game,
      createChessInteractionState(),
      'd4',
    )
    const snapshot = deriveChessInteractionSnapshot(game, nextState)

    expect(snapshot.legalTargets).toContainEqual({
      square: 'f6',
      kind: 'capture',
    })
  })

  it('ignores pieces that do not belong to the active color', () => {
    const game = createChessGame()
    const nextState = selectChessInteractionSquare(
      game,
      createChessInteractionState(),
      'e7',
    )
    const snapshot = deriveChessInteractionSnapshot(game, nextState)

    expect(snapshot.selectedSquare).toBeNull()
    expect(snapshot.legalTargets).toEqual([])
  })

  it('clears stale selection when the selected piece is no longer selectable', () => {
    const initialGame = createChessGame()
    const selectedState = selectChessInteractionSquare(
      initialGame,
      createChessInteractionState(),
      'e2',
    )
    const nextGame = createChessGame({
      turn: 'black',
    })

    const syncedState = syncChessInteractionState(nextGame, selectedState)
    const snapshot = deriveChessInteractionSnapshot(nextGame, syncedState)

    expect(snapshot.selectedSquare).toBeNull()
    expect(snapshot.legalTargets).toEqual([])
  })
})
