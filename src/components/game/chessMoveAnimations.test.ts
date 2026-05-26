import { describe, expect, it } from 'vitest'
import { createChessGame } from '../../chess/engine'
import { createChessSceneBinding } from '../../domain/chessScene'
import {
  areSameLastMove,
  createChessMoveAnimations,
  filterScenePiecesForAnimation,
} from './chessMoveAnimations'

describe('chessMoveAnimations', () => {
  it('creates a primary animation and hides the destination piece during a move', () => {
    const binding = createChessSceneBinding()
    const nextSnapshot = binding.move({ from: 'e2', to: 'e4' })
    const lastRecord = binding.getGame().history.at(-1) ?? null

    const animations = createChessMoveAnimations(nextSnapshot, lastRecord)
    const visiblePieces = filterScenePiecesForAnimation(
      nextSnapshot.pieces,
      animations,
    )

    expect(animations).toEqual([
      {
        id: '1-primary',
        from: 'e2',
        to: 'e4',
        piece: {
          square: 'e4',
          color: 'white',
          type: 'pawn',
        },
      },
    ])
    expect(visiblePieces.find((piece) => piece.square === 'e4')).toBeUndefined()
  })

  it('creates a secondary rook animation for castling moves', () => {
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'h1', color: 'white', type: 'rook' },
          { square: 'e8', color: 'black', type: 'king' },
        ],
      }),
    )
    const nextSnapshot = binding.move({ from: 'e1', to: 'g1' })
    const lastRecord = binding.getGame().history.at(-1) ?? null

    expect(createChessMoveAnimations(nextSnapshot, lastRecord)).toEqual([
      expect.objectContaining({
        id: '1-primary',
        from: 'e1',
        to: 'g1',
      }),
      expect.objectContaining({
        id: '1-rook',
        from: 'h1',
        to: 'f1',
        piece: expect.objectContaining({
          square: 'f1',
          color: 'white',
          type: 'rook',
        }),
      }),
    ])
  })

  it('uses the promoted piece type for promotion animations', () => {
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'e8', color: 'black', type: 'king' },
          { square: 'g7', color: 'white', type: 'pawn' },
        ],
      }),
    )
    const nextSnapshot = binding.move({
      from: 'g7',
      to: 'g8',
      promotion: 'queen',
    })
    const lastRecord = binding.getGame().history.at(-1) ?? null

    expect(createChessMoveAnimations(nextSnapshot, lastRecord)).toEqual([
      expect.objectContaining({
        piece: expect.objectContaining({
          square: 'g8',
          color: 'white',
          type: 'queen',
        }),
      }),
    ])
  })

  it('compares last-move records without allocating labels', () => {
    expect(
      areSameLastMove(
        { from: 'e2', to: 'e4', promotion: null },
        { from: 'e2', to: 'e4', promotion: null },
      ),
    ).toBe(true)
    expect(
      areSameLastMove(
        { from: 'e7', to: 'e8', promotion: 'queen' },
        { from: 'e7', to: 'e8', promotion: null },
      ),
    ).toBe(false)
  })
})
