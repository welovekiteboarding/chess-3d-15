import { describe, expect, it } from 'vitest'
import { INITIAL_PIECES } from './chessSetup'

describe('INITIAL_PIECES', () => {
  it('defines a full 32-piece starting arrangement', () => {
    expect(INITIAL_PIECES).toHaveLength(32)
  })

  it('places kings, queens, and corner rooks on their standard squares', () => {
    expect(
      INITIAL_PIECES.find(
        (piece) => piece.color === 'white' && piece.kind === 'king',
      ),
    ).toMatchObject({ square: 'e1' })
    expect(
      INITIAL_PIECES.find(
        (piece) => piece.color === 'black' && piece.kind === 'queen',
      ),
    ).toMatchObject({ square: 'd8' })

    const rooks = INITIAL_PIECES.filter((piece) => piece.kind === 'rook').map(
      (piece) => piece.square,
    )

    expect(rooks.sort()).toEqual(['a1', 'a8', 'h1', 'h8'])
  })

  it('fills the pawn ranks completely', () => {
    const pawns = INITIAL_PIECES.filter((piece) => piece.kind === 'pawn')

    expect(pawns).toHaveLength(16)
    expect(pawns.filter((piece) => piece.color === 'white')).toHaveLength(8)
    expect(pawns.filter((piece) => piece.color === 'black')).toHaveLength(8)
  })
})
