import { describe, expect, it, vi } from 'vitest'
import { createChessGame } from '../chess/engine'
import {
  createChessSceneBinding,
  createChessSceneSnapshot,
} from './chessScene'

describe('createChessSceneSnapshot', () => {
  it('derives renderable scene pieces from chess engine state', () => {
    const game = createChessGame()
    const snapshot = createChessSceneSnapshot(game)

    expect(snapshot.pieces).toHaveLength(32)
    expect(snapshot.turn).toBe('white')
    expect(snapshot.status).toBe('active')
    expect(snapshot.winner).toBeNull()
    expect(
      snapshot.pieces.find(
        (piece) =>
          piece.square === 'e1' &&
          piece.color === 'white' &&
          piece.type === 'king',
      ),
    ).toBeDefined()
    expect(
      snapshot.pieces.find(
        (piece) =>
          piece.square === 'd8' &&
          piece.color === 'black' &&
          piece.type === 'queen',
      ),
    ).toBeDefined()
  })

  it('returns cloned piece data so renderer consumers cannot mutate the game state', () => {
    const game = createChessGame()
    const snapshot = createChessSceneSnapshot(game)

    expect(snapshot.pieces).not.toBe(game.pieces)
    expect(snapshot.pieces[0]).not.toBe(game.pieces[0])
    expect(snapshot.lastMove).toBeNull()
  })
})

describe('createChessSceneBinding', () => {
  it('applies legal moves and updates the scene snapshot', () => {
    const binding = createChessSceneBinding()
    const updateListener = vi.fn()

    binding.subscribe(updateListener)

    const nextSnapshot = binding.move({ from: 'e2', to: 'e4' })

    expect(nextSnapshot.turn).toBe('black')
    expect(nextSnapshot.lastMove).toMatchObject({
      from: 'e2',
      to: 'e4',
    })
    expect(
      nextSnapshot.pieces.find((piece) => piece.square === 'e2'),
    ).toBeUndefined()
    expect(
      nextSnapshot.pieces.find(
        (piece) =>
          piece.square === 'e4' &&
          piece.color === 'white' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(binding.getGame().history).toHaveLength(1)
    expect(binding.getSnapshot()).toEqual(nextSnapshot)
    expect(updateListener).toHaveBeenCalledTimes(1)
    expect(updateListener).toHaveBeenCalledWith(nextSnapshot)
  })

  it('does not notify subscribers when a move is illegal', () => {
    const binding = createChessSceneBinding()
    const updateListener = vi.fn()

    binding.subscribe(updateListener)

    expect(() => binding.move({ from: 'e2', to: 'e5' })).toThrow(/illegal move/i)
    expect(updateListener).not.toHaveBeenCalled()
    expect(binding.getGame().history).toHaveLength(0)
  })
})
