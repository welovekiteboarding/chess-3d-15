import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createChessGame, makeMove } from '../../chess/engine'
import { ChessMoveHistory } from './ChessMoveHistory'

describe('ChessMoveHistory', () => {
  it('shows the dedicated history integration metadata and empty-state copy', () => {
    render(<ChessMoveHistory game={createChessGame()} />)

    expect(screen.getByText('Issue C31-40')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Graph task chess-009d wires the reusable move history surface into the live game controls/i,
      ),
    ).toBeInTheDocument()

    const moveHistory = screen.getByRole('list', { name: 'Move history' })

    expect(within(moveHistory).getByText('No moves yet.')).toBeInTheDocument()
    expect(screen.getByText('White captured')).toBeInTheDocument()
    expect(screen.getByText('Black captured')).toBeInTheDocument()
    expect(screen.getAllByText('None')).toHaveLength(2)
  })

  it('renders readable move history entries and captured pieces from the current game', () => {
    const game = [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ].reduce((state, move) => makeMove(state, move), createChessGame())

    render(<ChessMoveHistory game={game} />)

    const moveHistory = screen.getByRole('list', { name: 'Move history' })

    expect(
      within(moveHistory).getByText('1. White: Pawn e2 to e4'),
    ).toBeInTheDocument()
    expect(
      within(moveHistory).getByText('2. Black: Pawn d7 to d5'),
    ).toBeInTheDocument()
    expect(
      within(moveHistory).getByText('3. White: Pawn e4 captures d5'),
    ).toBeInTheDocument()
    expect(screen.getByText('Pawn')).toBeInTheDocument()
  })
})
