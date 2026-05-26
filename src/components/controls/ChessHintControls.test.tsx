import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createChessGame } from '../../chess/engine'
import { createChessSceneBinding } from '../../domain/chessScene'
import { ChessHintControls } from './ChessHintControls'

describe('ChessHintControls', () => {
  it('replaces a visible hint after the board changes and keeps dismissed hints hidden', () => {
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'g1', color: 'white', type: 'king' },
          { square: 'd4', color: 'white', type: 'queen' },
          { square: 'g8', color: 'black', type: 'king' },
          { square: 'd7', color: 'black', type: 'rook' },
        ],
        turn: 'white',
      }),
    )

    render(<ChessHintControls binding={binding} />)

    fireEvent.click(screen.getByRole('button', { name: 'Show hint' }))

    expect(screen.getByText('Recommended move: d4 -> d7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide hint' })).toBeInTheDocument()

    act(() => {
      binding.move({ from: 'd4', to: 'd5' })
    })

    expect(screen.getByText('Recommended move: d7 -> d5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hide hint' }))

    act(() => {
      binding.move({ from: 'd7', to: 'd5' })
    })

    expect(
      screen.getByText('Request a recommended move for the current player.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show hint' })).toBeInTheDocument()
  })
})
