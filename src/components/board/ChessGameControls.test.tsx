import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createChessGame, makeMove } from '../../chess/engine'
import { resignChessGame } from '../../chess/gameControls'
import { ChessGameControls } from './ChessGameControls'

describe('ChessGameControls', () => {
  it('shows readable move history and captured pieces from the current game', () => {
    const game = [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5' },
      { from: 'e4', to: 'd5' },
    ].reduce((state, move) => makeMove(state, move), createChessGame())

    render(
      <ChessGameControls
        game={game}
        onUndo={vi.fn()}
        onRestart={vi.fn()}
        onResign={vi.fn()}
      />,
    )

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

    expect(screen.getByText('White captured')).toBeInTheDocument()
    expect(screen.getByText('Pawn')).toBeInTheDocument()
    expect(screen.getByText('Black captured')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('disables controls when the current game state cannot use them', () => {
    const { rerender } = render(
      <ChessGameControls
        game={createChessGame()}
        onUndo={vi.fn()}
        onRestart={vi.fn()}
        onResign={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Restart game' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Undo move' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resign game' })).toBeEnabled()

    const activeGame = makeMove(createChessGame(), {
      from: 'e2',
      to: 'e4',
    })

    rerender(
      <ChessGameControls
        game={activeGame}
        onUndo={vi.fn()}
        onRestart={vi.fn()}
        onResign={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Undo move' })).toBeEnabled()

    rerender(
      <ChessGameControls
        game={resignChessGame(activeGame)}
        onUndo={vi.fn()}
        onRestart={vi.fn()}
        onResign={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Undo move' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Resign game' })).toBeDisabled()
  })
})
