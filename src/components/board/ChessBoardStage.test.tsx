import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createChessGame, makeMove } from '../../chess/engine'
import { createChessSceneBinding } from '../../domain/chessScene'
import type { ChessGameState, MoveInput } from '../../types/chess'
import { ChessBoardStage } from './ChessBoardStage'

vi.mock('../../scene/ChessScene', () => ({
  ChessScene: ({
    pieces = [],
    animatedPieces = [],
    highlightedSquares = [],
    onSquareSelect,
    selectedSquare = null,
  }: {
    pieces?: ReadonlyArray<{ square: string; color: string; type: string }>
    animatedPieces?: ReadonlyArray<{
      from: string
      to: string
      piece: { color: string; type: string }
    }>
    highlightedSquares?: ReadonlyArray<{ square: string; kind: string }>
    onSquareSelect?: (square: string) => void
    selectedSquare?: string | null
  }) => (
    <div>
      <div data-testid="scene-piece-count">{`${pieces.length} scene pieces`}</div>
      <div data-testid="scene-animated-pieces">
        {animatedPieces.length === 0
          ? 'none'
          : animatedPieces
              .map(
                (animation) =>
                  `${animation.from}->${animation.to}:${animation.piece.color}:${animation.piece.type}`,
              )
              .join(',')}
      </div>
      <div data-testid="scene-selected-square">{selectedSquare ?? 'none'}</div>
      <div data-testid="scene-highlighted-squares">
        {highlightedSquares
          .map((highlight) => `${highlight.square}:${highlight.kind}`)
          .join(',')}
      </div>
      {['d4', 'e2', 'e4', 'e5', 'f3', 'f6', 'g1'].map((square) => (
        <button
          key={square}
          onClick={() => onSquareSelect?.(square)}
          onPointerDown={() => onSquareSelect?.(square)}
          type="button"
        >
          {`select ${square}`}
        </button>
      ))}
    </div>
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

    expect(screen.getByText('Issue C31-27')).toBeInTheDocument()
    expect(screen.getByText('Graph task').closest('div')).toHaveTextContent(
      'chess-005c',
    )
    expect(screen.getByText('Issue C31-27').closest('aside')).toHaveAttribute(
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

  it('selects pieces from mouse and touch input and exposes legal targets to the scene', () => {
    render(<ChessBoardStage />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'select e2' }), {
      pointerType: 'mouse',
    })

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')
    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'e3:move,e4:move',
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: 'select g1' }), {
      pointerType: 'touch',
    })

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('g1')
    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'f3:move,h3:move',
    )
  })

  it('treats duplicate tap delivery as a single touch interaction', () => {
    render(<ChessBoardStage />)

    const sourceSquare = screen.getByRole('button', { name: 'select e2' })
    const targetSquare = screen.getByRole('button', { name: 'select e4' })

    fireEvent.pointerDown(sourceSquare, { pointerType: 'touch' })
    fireEvent.click(sourceSquare)

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')
    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'e3:move,e4:move',
    )

    fireEvent.pointerDown(targetSquare, { pointerType: 'touch' })
    fireEvent.click(targetSquare)

    expect(screen.getByText('Last move: e2 -> e4')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()
  })

  it('surfaces capture targets distinctly when a selected piece can capture', () => {
    render(
      <ChessBoardStage
        initialGame={createChessGame({
          pieces: [
            { square: 'e1', color: 'white', type: 'king' },
            { square: 'e8', color: 'black', type: 'king' },
            { square: 'd4', color: 'white', type: 'bishop' },
            { square: 'f6', color: 'black', type: 'rook' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select d4' }))

    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'f6:capture',
    )
  })

  it('commits a legal move from mouse and touch interaction', () => {
    vi.useFakeTimers()

    const { unmount } = render(<ChessBoardStage />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'select e2' }), {
      pointerType: 'mouse',
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'select e4' }), {
      pointerType: 'mouse',
    })

    expect(screen.getByTestId('scene-animated-pieces')).toHaveTextContent(
      'e2->e4:white:pawn',
    )
    expect(screen.getByText('Last move: e2 -> e4')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(260)
    })

    expect(screen.getByTestId('scene-animated-pieces')).toHaveTextContent('none')

    unmount()
    render(<ChessBoardStage />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'select g1' }), {
      pointerType: 'touch',
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: 'select f3' }), {
      pointerType: 'touch',
    })

    expect(screen.getByText('Last move: g1 -> f3')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('blocks illegal moves and shows subtle feedback without clearing the active selection', () => {
    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e5' }))

    expect(screen.getByText('Opening position')).toBeInTheDocument()
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')
    expect(screen.getByText('Illegal move blocked')).toBeInTheDocument()
    expect(
      screen.getByText('Choose one of the highlighted destinations to move.'),
    ).toBeInTheDocument()
  })
})
