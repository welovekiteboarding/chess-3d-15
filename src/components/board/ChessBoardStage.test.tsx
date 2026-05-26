import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createChessAiMatchSettings } from '../../ai/gameMode'
import {
  createChessGame,
  generateLegalMoves,
  makeMove,
} from '../../chess/engine'
import { createChessSceneBinding } from '../../domain/chessScene'
import {
  resolveChessSquareSelectPointerType,
  type ChessSquareSelectInput,
} from '../../input/chessInputDeduplication'
import type { ChessGameState, LegalMove, MoveInput } from '../../types/chess'
import { CHESS_MOVE_ANIMATION_DURATION_MS } from '../game/chessMoveAnimations'
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
    onSquareSelect?: (square: string, input?: ChessSquareSelectInput) => void
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
          onClick={() =>
            onSquareSelect?.(square, {
              source: 'click',
              pointerType: 'unknown',
            })
          }
          onPointerDown={(event) =>
            onSquareSelect?.(square, {
              source: 'pointerdown',
              pointerType: resolveChessSquareSelectPointerType(event),
            })
          }
          type="button"
        >
          {`select ${square}`}
        </button>
      ))}
      <button
        onClick={() =>
          onSquareSelect?.('e2', {
            source: 'pointerdown',
            pointerType: 'touch',
            timestampMs: 120,
          })
        }
        type="button"
      >
        select e2 touch timed
      </button>
      <button
        onClick={() =>
          onSquareSelect?.('e2', {
            source: 'click',
            pointerType: 'unknown',
          })
        }
        type="button"
      >
        select e2 click untimed
      </button>
    </div>
  ),
}))

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

function findLegalMove(
  game: ChessGameState,
  from: string,
  to: string,
): LegalMove {
  const move = generateLegalMoves(game).find(
    (candidate) => candidate.from === from && candidate.to === to,
  )

  if (move === undefined) {
    throw new Error(`Expected ${from} -> ${to} to be legal`)
  }

  return move
}

function createDeferredMove() {
  let resolve!: (move: LegalMove) => void
  const promise = new Promise<LegalMove>((nextResolve) => {
    resolve = nextResolve
  })

  return {
    promise,
    resolve,
  }
}

function getBoardStatusList() {
  return screen.getByRole('list', { name: 'Board status' })
}

describe('ChessBoardStage', () => {
  it('renders the current turn and engine-backed starting snapshot', () => {
    render(<ChessBoardStage />)

    const notes = getBoardStatusList()

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

    expect(screen.getAllByText('Issue C31-39')).toHaveLength(2)
    expect(screen.getByText('Graph task').closest('div')).toHaveTextContent(
      'chess-009c',
    )
    expect(screen.getByRole('heading', { name: 'White to move' }).closest('aside')).toHaveAttribute(
      'aria-live',
      'polite',
    )
  })

  it('lets the user choose human-vs-ai mode and difficulty through the board rail', () => {
    const handleAiMatchSettingsChange = vi.fn()

    render(
      <ChessBoardStage onAiMatchSettingsChange={handleAiMatchSettingsChange} />,
    )

    expect(screen.getByRole('radio', { name: 'Human vs Human' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked()
    expect(screen.getByText('Local human play')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Human vs AI' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Hard' }))

    expect(screen.getByRole('radio', { name: 'Human vs AI' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Hard' })).toBeChecked()
    expect(screen.getByText('AI opponent ready')).toBeInTheDocument()
    expect(handleAiMatchSettingsChange).toHaveBeenNthCalledWith(
      1,
      createChessAiMatchSettings({
        mode: 'human-vs-ai',
      }),
    )
    expect(handleAiMatchSettingsChange).toHaveBeenNthCalledWith(
      2,
      createChessAiMatchSettings({
        mode: 'human-vs-ai',
        difficulty: 'hard',
      }),
    )
  })

  it('restarts the current game from the original seed position', () => {
    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    expect(screen.getByText('Last move: e2 -> e4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restart game' }))

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Opening position')).toBeInTheDocument()
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')
  })

  it('undoes the latest move in local play', () => {
    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    expect(screen.getByText('Last move: e2 -> e4')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo move' }))

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Opening position')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo move' })).toBeDisabled()
  })

  it('lets the current player resign and blocks further board interaction until restart', () => {
    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'Resign game' }))

    expect(
      screen.getByRole('heading', { name: 'Game ended' }),
    ).toBeInTheDocument()
    expect(within(getBoardStatusList()).getByText('Resignation')).toBeInTheDocument()
    expect(screen.getByText('Black wins by resignation.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resign game' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')
  })

  it('shows AI thinking and applies an AI reply after the human move animation completes', async () => {
    vi.useFakeTimers()

    const pendingMove = createDeferredMove()
    const aiMoveClient = {
      dispose: vi.fn(),
      selectMove: vi.fn(() => pendingMove.promise),
    }

    render(
      <ChessBoardStage
        aiMatchSettings={createChessAiMatchSettings({
          mode: 'human-vs-ai',
          difficulty: 'hard',
        })}
        createAiMoveClient={() => aiMoveClient}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    expect(screen.getByText('Last move: e2 -> e4')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()
    expect(aiMoveClient.selectMove).not.toHaveBeenCalled()
    expect(screen.queryByText('AI thinking')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(CHESS_MOVE_ANIMATION_DURATION_MS)
    })

    expect(aiMoveClient.selectMove).toHaveBeenCalledTimes(1)
    expect(aiMoveClient.selectMove).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: 'hard',
      }),
    )
    expect(screen.getAllByText('AI thinking')).not.toHaveLength(0)

    const gameAfterHumanMove = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
    ])

    await act(async () => {
      pendingMove.resolve(findLegalMove(gameAfterHumanMove, 'e7', 'e5'))
      await pendingMove.promise
    })

    expect(screen.getByText('Last move: e7 -> e5')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('AI thinking')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('resigns for the human side even when the AI controls the active turn', () => {
    vi.useFakeTimers()

    render(
      <ChessBoardStage
        aiMatchSettings={createChessAiMatchSettings({
          mode: 'human-vs-ai',
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    fireEvent.click(screen.getByRole('button', { name: 'Resign game' }))

    expect(screen.getAllByText('Black wins by resignation.')).toHaveLength(2)

    vi.useRealTimers()
  })

  it('undoes the pending human move during an AI turn and cancels the queued reply', () => {
    vi.useFakeTimers()

    const pendingMove = createDeferredMove()
    const aiMoveClient = {
      dispose: vi.fn(),
      selectMove: vi.fn(() => pendingMove.promise),
    }

    render(
      <ChessBoardStage
        aiMatchSettings={createChessAiMatchSettings({
          mode: 'human-vs-ai',
          difficulty: 'medium',
        })}
        createAiMoveClient={() => aiMoveClient}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo move' }))

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Opening position')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(CHESS_MOVE_ANIMATION_DURATION_MS)
    })

    expect(aiMoveClient.selectMove).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('rewinds both the AI reply and the preceding human move with one undo', async () => {
    vi.useFakeTimers()

    const pendingMove = createDeferredMove()
    const aiMoveClient = {
      dispose: vi.fn(),
      selectMove: vi.fn(() => pendingMove.promise),
    }

    render(
      <ChessBoardStage
        aiMatchSettings={createChessAiMatchSettings({
          mode: 'human-vs-ai',
          difficulty: 'hard',
        })}
        createAiMoveClient={() => aiMoveClient}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    act(() => {
      vi.advanceTimersByTime(CHESS_MOVE_ANIMATION_DURATION_MS)
    })

    const gameAfterHumanMove = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
    ])

    await act(async () => {
      pendingMove.resolve(findLegalMove(gameAfterHumanMove, 'e7', 'e5'))
      await pendingMove.promise
    })

    expect(screen.getByText('Last move: e7 -> e5')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo move' }))

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Opening position')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo move' })).toBeDisabled()

    vi.useRealTimers()
  })

  it('blocks further human moves for the full duration of an AI-controlled turn', async () => {
    vi.useFakeTimers()

    const pendingMove = createDeferredMove()
    const aiMoveClient = {
      dispose: vi.fn(),
      selectMove: vi.fn(() => pendingMove.promise),
    }

    render(
      <ChessBoardStage
        aiMatchSettings={createChessAiMatchSettings({
          mode: 'human-vs-ai',
          difficulty: 'medium',
        })}
        createAiMoveClient={() => aiMoveClient}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    fireEvent.click(screen.getByRole('button', { name: 'select g1' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')

    act(() => {
      vi.advanceTimersByTime(CHESS_MOVE_ANIMATION_DURATION_MS)
    })

    expect(screen.getAllByText('AI thinking')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'select g1' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')

    const gameAfterHumanMove = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
    ])

    await act(async () => {
      pendingMove.resolve(findLegalMove(gameAfterHumanMove, 'e7', 'e5'))
      await pendingMove.promise
    })

    fireEvent.click(screen.getByRole('button', { name: 'select g1' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('g1')

    vi.useRealTimers()
  })

  it('renders injected controls inside the live board rail', () => {
    render(<ChessBoardStage controls={<div>Hint controls surface</div>} />)

    expect(screen.getByText('Hint controls surface')).toBeInTheDocument()
    expect(screen.getByText('Hint controls surface').closest('aside')).toHaveAttribute(
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

    const notes = getBoardStatusList()

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

  it('renders checkmate, stalemate, and draw states from engine state', () => {
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
    const drawGame = createChessGame({
      pieces: [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
      ],
      halfmoveClock: 100,
    })

    const { rerender } = render(<ChessBoardStage initialGame={checkmateGame} />)

    expect(within(getBoardStatusList()).getByText('Checkmate')).toBeInTheDocument()
    expect(
      screen.getByText('Black wins. White has no legal move to escape check.'),
    ).toBeInTheDocument()

    rerender(<ChessBoardStage initialGame={stalemateGame} />)

    expect(
      screen.getByRole('heading', { name: 'Black to move' }),
    ).toBeInTheDocument()
    expect(within(getBoardStatusList()).getByText('Stalemate')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Black has no legal moves, and neither king is in check.',
      ),
    ).toBeInTheDocument()

    rerender(<ChessBoardStage initialGame={drawGame} />)

    expect(
      screen.getByRole('heading', { name: 'White to move' }),
    ).toBeInTheDocument()
    expect(within(getBoardStatusList()).getByText('Draw')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The game is drawn by the fifty-move rule after 50 quiet moves by each side.',
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
    expect(within(getBoardStatusList()).getByText('Checkmate')).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))

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
    vi.useFakeTimers()

    render(<ChessBoardStage />)

    const sourceSquare = screen.getByRole('button', { name: 'select e2' })
    const targetSquare = screen.getByRole('button', { name: 'select e4' })

    fireEvent.pointerDown(sourceSquare, { pointerType: 'touch' })
    act(() => {
      vi.advanceTimersByTime(320)
    })
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

    vi.useRealTimers()
  })

  it('allows a second touch tap on the same piece to clear the selection', () => {
    render(<ChessBoardStage />)

    const sourceSquare = screen.getByRole('button', { name: 'select e2' })

    fireEvent.pointerDown(sourceSquare, { pointerType: 'touch' })
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    fireEvent.pointerDown(sourceSquare, { pointerType: 'touch' })
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')
  })

  it('deduplicates a touch click fallback when the pointer-down used a relative event timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'))

    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2 touch timed' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    act(() => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByRole('button', { name: 'select e2 click untimed' }))

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')
    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'e3:move,e4:move',
    )

    vi.useRealTimers()
  })

  it('resets touch deduplication after restart so the next click starts a fresh move', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'))

    render(<ChessBoardStage />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2 touch timed' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    fireEvent.click(screen.getByRole('button', { name: 'Restart game' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    act(() => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByRole('button', { name: 'select e2 click untimed' }))

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')

    vi.useRealTimers()
  })

  it('resets touch deduplication after resign so an externally restarted game starts cleanly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-26T12:00:00.000Z'))

    const binding = createChessSceneBinding()

    render(<ChessBoardStage binding={binding} />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2 touch timed' }))
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    fireEvent.click(screen.getByRole('button', { name: 'Resign game' }))
    expect(
      screen.getByRole('heading', { name: 'Game ended' }),
    ).toBeInTheDocument()

    act(() => {
      binding.restart()
    })
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    act(() => {
      vi.advanceTimersByTime(120)
    })
    fireEvent.click(screen.getByRole('button', { name: 'select e2 click untimed' }))

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('none')

    vi.useRealTimers()
  })

  it('ignores a delayed touch click follow-up after a newer touch selection changed squares', () => {
    render(<ChessBoardStage />)

    const firstSquare = screen.getByRole('button', { name: 'select e2' })
    const secondSquare = screen.getByRole('button', { name: 'select g1' })

    fireEvent.pointerDown(firstSquare, { pointerType: 'touch' })
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('e2')

    fireEvent.pointerDown(secondSquare, { pointerType: 'touch' })
    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('g1')

    fireEvent.click(firstSquare)

    expect(screen.getByTestId('scene-selected-square')).toHaveTextContent('g1')
    expect(screen.getByTestId('scene-highlighted-squares')).toHaveTextContent(
      'f3:move,h3:move',
    )
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

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

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

  it('keeps the current move animation when a binding replays the same move snapshot', () => {
    vi.useFakeTimers()

    const baseBinding = createChessSceneBinding()
    const replayingBinding = {
      getGame: () => baseBinding.getGame(),
      getSnapshot: () => baseBinding.getSnapshot(),
      move(input: MoveInput) {
        const snapshot = baseBinding.move(input)

        listeners.forEach((listener) => {
          listener(snapshot)
          listener(snapshot)
        })

        return snapshot
      },
      undo(plies?: number) {
        const snapshot = baseBinding.undo(plies)

        listeners.forEach((listener) => {
          listener(snapshot)
        })

        return snapshot
      },
      restart() {
        const snapshot = baseBinding.restart()

        listeners.forEach((listener) => {
          listener(snapshot)
        })

        return snapshot
      },
      resign(resignedColor?: ChessGameState['turn']) {
        const snapshot = baseBinding.resign(resignedColor)

        listeners.forEach((listener) => {
          listener(snapshot)
        })

        return snapshot
      },
      subscribe(listener: (snapshot: ReturnType<typeof baseBinding.getSnapshot>) => void) {
        listeners.add(listener)
        listener(baseBinding.getSnapshot())

        return () => {
          listeners.delete(listener)
        }
      },
    }
    const listeners = new Set<
      (snapshot: ReturnType<typeof baseBinding.getSnapshot>) => void
    >()

    render(<ChessBoardStage binding={replayingBinding} />)

    fireEvent.click(screen.getByRole('button', { name: 'select e2' }))
    fireEvent.click(screen.getByRole('button', { name: 'select e4' }))

    expect(screen.getByTestId('scene-animated-pieces')).toHaveTextContent(
      'e2->e4:white:pawn',
    )

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
