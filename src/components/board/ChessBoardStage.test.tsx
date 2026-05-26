import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createChessGame, makeMove } from '../../chess/engine'
import { createChessSceneBinding } from '../../domain/chessScene'
import type { ChessGameState, MoveInput } from '../../types/chess'
import { ChessBoardStage } from './ChessBoardStage'

vi.mock('../../scene/ChessScene', () => ({
  ChessScene: ({
    pieces = [],
  }: {
    pieces?: ReadonlyArray<{ square: string; color: string; type: string }>
  }) => (
    <div data-testid="scene-piece-count">{`${pieces.length} scene pieces`}</div>
  ),
}))

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

describe('ChessBoardStage', () => {
  it('renders the current turn and engine-backed starting snapshot', () => {
    render(<ChessBoardStage />)

    const notes = screen.getByRole('list')

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.getByText('White controls the next move.')).toBeInTheDocument()
    expect(screen.getByTestId('scene-piece-count')).toHaveTextContent(
      '32 scene pieces',
    )
    expect(within(notes).getByText('Game in progress')).toBeInTheDocument()
    expect(within(notes).getByText('Opening position')).toBeInTheDocument()
  })

  it('surfaces the current integration issue metadata in the live board rail', () => {
    render(<ChessBoardStage />)

    expect(screen.getByText('Issue C31-24')).toBeInTheDocument()
    expect(screen.getByText('Graph task').closest('div')).toHaveTextContent(
      'chess-004d',
    )
    expect(screen.getByText('Issue C31-24').closest('aside')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })

  it('renders check status from the supplied engine state', () => {
    const checkedGame = createChessGame({
      pieces: [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
        { square: 'e4', color: 'white', type: 'rook' },
      ],
      turn: 'black',
    })

    render(<ChessBoardStage initialGame={checkedGame} />)

    const notes = screen.getByRole('list')

    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Black must answer the threat on this turn.'),
    ).toBeInTheDocument()
    expect(screen.getByTestId('scene-piece-count')).toHaveTextContent(
      '3 scene pieces',
    )
    expect(within(notes).getByText('Black is in check')).toBeInTheDocument()
  })

  it('renders checkmate and stalemate states from engine state', () => {
    const checkmateGame = playMoves(createChessGame(), [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])
    const stalemateGame = createChessGame({
      pieces: [
        { square: 'f7', color: 'white', type: 'king' },
        { square: 'g6', color: 'white', type: 'queen' },
        { square: 'h8', color: 'black', type: 'king' },
      ],
      turn: 'black',
    })

    const { rerender } = render(<ChessBoardStage initialGame={checkmateGame} />)

    expect(
      within(screen.getByRole('list')).getByText('Checkmate'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Black wins. White has no legal move to escape check.'),
    ).toBeInTheDocument()

    rerender(<ChessBoardStage initialGame={stalemateGame} />)

    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list')).getByText('Stalemate'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Black has no legal moves, and neither king is in check.',
      ),
    ).toBeInTheDocument()
  })

  it('subscribes to binding updates so turn and terminal status stay in sync', () => {
    const binding = createChessSceneBinding()

    render(<ChessBoardStage binding={binding} />)

    act(() => {
      binding.move({ from: 'f2', to: 'f3' })
      binding.move({ from: 'e7', to: 'e5' })
      binding.move({ from: 'g2', to: 'g4' })
      binding.move({ from: 'd8', to: 'h4' })
    })

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list')).getByText('Checkmate'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Black wins. White has no legal move to escape check.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Last move: d8 -> h4')).toBeInTheDocument()
  })

  it('surfaces promotion moves in the board-stage runtime chips', () => {
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'e8', color: 'black', type: 'king' },
          { square: 'g7', color: 'white', type: 'pawn' },
        ],
      }),
    )

    render(<ChessBoardStage binding={binding} />)

    act(() => {
      binding.move({
        from: 'g7',
        to: 'g8',
        promotion: 'queen',
      })
    })

    expect(
      screen.getByText('Last move: g7 -> g8 = queen'),
    ).toBeInTheDocument()
  })
})
