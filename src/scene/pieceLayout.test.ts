import { describe, expect, it } from 'vitest'
import { createStartingPieceLayout } from './pieceLayout'

describe('pieceLayout', () => {
  it('creates the full 32-piece starting layout', () => {
    const layout = createStartingPieceLayout()

    expect(layout).toHaveLength(32)
    expect(layout.filter((piece) => piece.color === 'white')).toHaveLength(16)
    expect(layout.filter((piece) => piece.color === 'black')).toHaveLength(16)
  })

  it('places the major pieces and pawns on their standard opening squares', () => {
    const layout = createStartingPieceLayout()

    expect(layout).toContainEqual({
      color: 'white',
      kind: 'king',
      square: 'e1',
    })
    expect(layout).toContainEqual({
      color: 'white',
      kind: 'queen',
      square: 'd1',
    })
    expect(layout).toContainEqual({
      color: 'black',
      kind: 'king',
      square: 'e8',
    })
    expect(layout).toContainEqual({
      color: 'black',
      kind: 'queen',
      square: 'd8',
    })
    expect(layout.filter((piece) => piece.kind === 'pawn')).toHaveLength(16)
    expect(layout).toContainEqual({
      color: 'white',
      kind: 'pawn',
      square: 'a2',
    })
    expect(layout).toContainEqual({
      color: 'black',
      kind: 'pawn',
      square: 'h7',
    })
  })
})
