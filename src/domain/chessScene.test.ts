import { describe, expect, it, vi } from 'vitest'
import { createChessGame, makeMove } from '../chess/engine'
import {
  createChessSceneBinding,
  createChessSceneSnapshot,
  describeChessSceneStatus,
} from './chessScene'
import type { ChessGameState, ChessSceneSnapshot, MoveInput } from '../types/chess'

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

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
  it('emits the current turn and status immediately when a listener subscribes', () => {
    const binding = createChessSceneBinding(
      createChessGame({
        pieces: [
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'e8', color: 'black', type: 'king' },
          { square: 'e4', color: 'white', type: 'rook' },
        ],
        turn: 'black',
      }),
    )
    const updateListener = vi.fn()

    const unsubscribe = binding.subscribe(updateListener)

    expect(updateListener).toHaveBeenCalledTimes(1)
    expect(
      describeChessSceneStatus(updateListener.mock.calls[0]![0]),
    ).toEqual({
      turnLabel: 'Black to move',
      statusLabel: 'Black is in check',
      statusDetail: 'Black must answer the threat on this turn.',
    })

    unsubscribe()
  })

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
    expect(updateListener).toHaveBeenCalledTimes(2)
    expect(updateListener.mock.calls[0]![0]).toMatchObject({
      turn: 'white',
      status: 'active',
      lastMove: null,
    })
    expect(updateListener.mock.calls[1]![0]).toEqual(nextSnapshot)
  })

  it('isolates move snapshots across subscribers', () => {
    const binding = createChessSceneBinding()
    const firstListener = vi.fn((snapshot) => {
      if (snapshot.lastMove !== null) {
        snapshot.pieces[0]!.square = 'c3'
      }
    })
    const secondListener = vi.fn()

    binding.subscribe(firstListener)
    binding.subscribe(secondListener)

    binding.move({ from: 'e2', to: 'e4' })

    const secondMoveSnapshot = secondListener.mock.calls[1]![0] as ChessSceneSnapshot

    expect(secondListener).toHaveBeenCalledTimes(2)
    expect(secondMoveSnapshot.lastMove).toEqual({
      from: 'e2',
      to: 'e4',
      promotion: null,
    })
    expect(
      secondMoveSnapshot.pieces.find(
        (piece) =>
          piece.square === 'e4' &&
          piece.color === 'white' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      secondMoveSnapshot.pieces.find(
        (piece) =>
          piece.square === 'c3' &&
          piece.color === 'white' &&
          piece.type === 'rook',
      ),
    ).toBeUndefined()
  })

  it('removes captured pieces from the scene snapshot', () => {
    const binding = createChessSceneBinding()

    binding.move({ from: 'e2', to: 'e4' })
    binding.move({ from: 'd7', to: 'd5' })

    const nextSnapshot = binding.move({ from: 'e4', to: 'd5' })

    expect(nextSnapshot.pieces).toHaveLength(31)
    expect(
      nextSnapshot.pieces.find(
        (piece) =>
          piece.square === 'd5' &&
          piece.color === 'white' &&
          piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      nextSnapshot.pieces.find(
        (piece) => piece.square === 'e4' && piece.color === 'white',
      ),
    ).toBeUndefined()
    expect(
      nextSnapshot.pieces.find(
        (piece) => piece.square === 'd5' && piece.color === 'black',
      ),
    ).toBeUndefined()
  })

  it('updates the scene snapshot piece type after promotion', () => {
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

    expect(
      nextSnapshot.pieces.find((piece) => piece.square === 'g7'),
    ).toBeUndefined()
    expect(
      nextSnapshot.pieces.find(
        (piece) =>
          piece.square === 'g8' &&
          piece.color === 'white' &&
          piece.type === 'queen',
      ),
    ).toBeDefined()
    expect(nextSnapshot.lastMove).toEqual({
      from: 'g7',
      to: 'g8',
      promotion: 'queen',
    })
  })

  it('does not notify subscribers when a move is illegal', () => {
    const binding = createChessSceneBinding()
    const updateListener = vi.fn()

    binding.subscribe(updateListener)

    expect(() => binding.move({ from: 'e2', to: 'e5' })).toThrow(/illegal move/i)
    expect(updateListener).toHaveBeenCalledTimes(1)
    expect(updateListener.mock.calls[0]![0]).toMatchObject({
      turn: 'white',
      status: 'active',
      lastMove: null,
    })
    expect(binding.getGame().history).toHaveLength(0)
  })

  it('returns cloned game data so external callers cannot mutate binding state', () => {
    const binding = createChessSceneBinding()
    const exposedGame = binding.getGame()

    exposedGame.pieces[0]!.square = 'h8'
    exposedGame.history.push({
      index: 999,
      input: { from: 'a2', to: 'a3' },
      move: {
        from: 'a2',
        to: 'a3',
        piece: { color: 'white', type: 'pawn' },
        capturedPiece: null,
        promotion: null,
        isCapture: false,
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isCastling: false,
        isEnPassant: false,
        rookFrom: null,
        rookTo: null,
      },
      before: createChessGame(),
      after: createChessGame(),
    })

    const internalGame = binding.getGame()

    expect(
      internalGame.pieces.find(
        (piece) =>
          piece.square === 'a1' &&
          piece.color === 'white' &&
          piece.type === 'rook',
      ),
    ).toBeDefined()
    expect(internalGame.history).toHaveLength(0)
  })
})

describe('describeChessSceneStatus', () => {
  it('prefers explicit status fields when a scene snapshot is partially denormalized', () => {
    expect(
      describeChessSceneStatus({
        turn: 'white',
        status: 'check',
        checkedColor: 'black',
        winner: null,
      }),
    ).toEqual({
      turnLabel: 'Black to move',
      statusLabel: 'Black is in check',
      statusDetail: 'Black must answer the threat on this turn.',
    })

    expect(
      describeChessSceneStatus({
        turn: 'black',
        status: 'checkmate',
        checkedColor: 'black',
        winner: 'black',
      }),
    ).toEqual({
      turnLabel: 'White to move',
      statusLabel: 'Checkmate',
      statusDetail: 'Black wins. White has no legal move to escape check.',
    })
  })

  it('describes active and check positions for UI consumers', () => {
    const activeGame = createChessGame()
    const checkedGame = createChessGame(
      {
        pieces: [
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'e8', color: 'black', type: 'king' },
          { square: 'e4', color: 'white', type: 'rook' },
        ],
        turn: 'black',
      },
    )

    expect(describeChessSceneStatus(createChessSceneSnapshot(activeGame))).toEqual({
      turnLabel: 'White to move',
      statusLabel: 'Game in progress',
      statusDetail: 'White controls the next move.',
    })
    expect(
      describeChessSceneStatus(createChessSceneSnapshot(checkedGame)),
    ).toEqual({
      turnLabel: 'Black to move',
      statusLabel: 'Black is in check',
      statusDetail: 'Black must answer the threat on this turn.',
    })
  })

  it('describes checkmate and stalemate positions for UI consumers', () => {
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

    expect(
      describeChessSceneStatus(createChessSceneSnapshot(checkmateGame)),
    ).toEqual({
      turnLabel: 'White to move',
      statusLabel: 'Checkmate',
      statusDetail: 'Black wins. White has no legal move to escape check.',
    })
    expect(
      describeChessSceneStatus(createChessSceneSnapshot(stalemateGame)),
    ).toEqual({
      turnLabel: 'Black to move',
      statusLabel: 'Stalemate',
      statusDetail: 'Black has no legal moves, and neither king is in check.',
    })
  })
})
