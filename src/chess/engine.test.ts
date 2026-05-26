import { describe, expect, it } from 'vitest'

import {
  applyLegalMove,
  applyLegalMoveState,
  applySearchMove,
  createChessPositionKey,
  createSearchPosition,
  createChessGame,
  generateLegalMoves,
  generateSearchLegalMoves,
  generateSearchLegalMovesFromPosition,
  getPieceAtSquare,
  isInCheck,
  isSearchPositionInCheck,
  makeMove,
  replayGameHistory,
} from './engine'
import type {
  ChessGameOptions,
  ChessGameState,
  LegalMove,
  ChessPiecePlacement,
  MoveInput,
} from '../types/chess'

function createCustomGame(
  pieces: ChessPiecePlacement[],
  options: Omit<ChessGameOptions, 'pieces'> = {},
): ChessGameState {
  return createChessGame({
    pieces,
    ...options,
  })
}

function playMoves(game: ChessGameState, moves: MoveInput[]): ChessGameState {
  return moves.reduce((state, move) => makeMove(state, move), game)
}

function listDestinations(game: ChessGameState, square: string): string[] {
  return generateLegalMoves(game, square)
    .map((move) => move.to)
    .sort()
}

function moveKeys(moves: LegalMove[]): string[] {
  return moves
    .map((move) => `${move.from}-${move.to}-${move.promotion ?? 'none'}`)
    .sort()
}

describe('createChessGame', () => {
  it('creates the standard starting position with white to move', () => {
    const game = createChessGame()

    expect(game.pieces).toHaveLength(32)
    expect(game.turn).toBe('white')
    expect(getPieceAtSquare(game, 'e1')).toMatchObject({
      color: 'white',
      type: 'king',
    })
    expect(getPieceAtSquare(game, 'd8')).toMatchObject({
      color: 'black',
      type: 'queen',
    })
    expect(generateLegalMoves(game)).toHaveLength(20)
    expect(game.castlingRights.white).toEqual({
      kingSide: true,
      queenSide: true,
    })
    expect(game.castlingRights.black).toEqual({
      kingSide: true,
      queenSide: true,
    })
  })
})

describe('generateLegalMoves', () => {
  it('generates legal moves for every piece type on open boards', () => {
    expect(
      listDestinations(
        createCustomGame([
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'a8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'queen' },
        ]),
        'd4',
      ),
    ).toEqual([
      'a1',
      'a4',
      'a7',
      'b2',
      'b4',
      'b6',
      'c3',
      'c4',
      'c5',
      'd1',
      'd2',
      'd3',
      'd5',
      'd6',
      'd7',
      'd8',
      'e3',
      'e4',
      'e5',
      'f2',
      'f4',
      'f6',
      'g1',
      'g4',
      'g7',
      'h4',
      'h8',
    ])

    expect(
      listDestinations(
        createCustomGame([
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'a8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'rook' },
        ]),
        'd4',
      ),
    ).toEqual([
      'a4',
      'b4',
      'c4',
      'd1',
      'd2',
      'd3',
      'd5',
      'd6',
      'd7',
      'd8',
      'e4',
      'f4',
      'g4',
      'h4',
    ])

    expect(
      listDestinations(
        createCustomGame([
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'a8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'bishop' },
        ]),
        'd4',
      ),
    ).toEqual([
      'a1',
      'a7',
      'b2',
      'b6',
      'c3',
      'c5',
      'e3',
      'e5',
      'f2',
      'f6',
      'g1',
      'g7',
      'h8',
    ])

    expect(
      listDestinations(
        createCustomGame([
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'a8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'knight' },
        ]),
        'd4',
      ),
    ).toEqual(['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'])

    expect(
      listDestinations(
        createCustomGame([
          { square: 'h8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'king' },
        ]),
        'd4',
      ),
    ).toEqual(['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'])

    expect(
      listDestinations(
        createCustomGame([
          { square: 'e1', color: 'white', type: 'king' },
          { square: 'a8', color: 'black', type: 'king' },
          { square: 'd4', color: 'white', type: 'pawn' },
        ]),
        'd4',
      ),
    ).toEqual(['d5'])
  })

  it('rejects moves that are not legal in the current position', () => {
    const game = createChessGame()

    expect(() => makeMove(game, { from: 'e2', to: 'e5' })).toThrow(
      /illegal move/i,
    )
  })

  it('rejects moves that would leave the moving side in check', () => {
    const game = createCustomGame([
      { square: 'e1', color: 'white', type: 'king' },
      { square: 'e2', color: 'white', type: 'rook' },
      { square: 'e8', color: 'black', type: 'rook' },
      { square: 'h8', color: 'black', type: 'king' },
    ])

    expect(generateLegalMoves(game, 'e2').map((move) => move.to).sort()).toEqual(
      ['e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
    )
    expect(() => makeMove(game, { from: 'e2', to: 'd2' })).toThrow(
      /illegal move/i,
    )
  })
})

describe('checks and terminal states', () => {
  it('detects check on the side to move', () => {
    const game = createCustomGame(
      [
        { square: 'e1', color: 'white', type: 'king' },
        { square: 'e8', color: 'black', type: 'king' },
        { square: 'e4', color: 'white', type: 'rook' },
      ],
      { turn: 'black' },
    )

    expect(game.status).toBe('check')
    expect(isInCheck(game, 'black')).toBe(true)
    expect(isInCheck(game, 'white')).toBe(false)
  })

  it("detects Fool's Mate as checkmate", () => {
    const game = playMoves(createChessGame(), [
      { from: 'f2', to: 'f3' },
      { from: 'e7', to: 'e5' },
      { from: 'g2', to: 'g4' },
      { from: 'd8', to: 'h4' },
    ])

    expect(game.status).toBe('checkmate')
    expect(game.winner).toBe('black')
    expect(isInCheck(game, 'white')).toBe(true)
    expect(generateLegalMoves(game)).toHaveLength(0)
  })

  it('detects stalemate when the side to move has no legal moves and is not in check', () => {
    const game = createCustomGame(
      [
        { square: 'f7', color: 'white', type: 'king' },
        { square: 'g6', color: 'white', type: 'queen' },
        { square: 'h8', color: 'black', type: 'king' },
      ],
      { turn: 'black' },
    )

    expect(game.status).toBe('stalemate')
    expect(game.winner).toBeNull()
    expect(isInCheck(game, 'black')).toBe(false)
    expect(generateLegalMoves(game)).toHaveLength(0)
  })
})

describe('applyLegalMoveState', () => {
  it('updates position fields for search without building full history', () => {
    const game = createChessGame()
    const move = generateLegalMoves(game, 'e2').find(
      (legalMove) => legalMove.to === 'e4',
    )

    expect(move).toBeDefined()

    const positionState = applyLegalMoveState(game, move!)
    const nextGame = applyLegalMove(game, move!)

    expect(positionState.pieces).toEqual(nextGame.pieces)
    expect(positionState.turn).toBe(nextGame.turn)
    expect(positionState.castlingRights).toEqual(nextGame.castlingRights)
    expect(positionState.enPassantTarget).toBe(nextGame.enPassantTarget)
    expect(positionState.halfmoveClock).toBe(nextGame.halfmoveClock)
    expect(positionState.fullmoveNumber).toBe(nextGame.fullmoveNumber)
  })
})

describe('generateSearchLegalMoves', () => {
  it('returns the same legal move set without requiring outcome annotations', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    expect(moveKeys(generateSearchLegalMoves(game))).toEqual(
      moveKeys(generateLegalMoves(game)),
    )
  })
})

describe('search position helpers', () => {
  it('generate the same search move set from the internal search position', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )

    const searchPosition = createSearchPosition(game)

    expect(moveKeys(generateSearchLegalMovesFromPosition(searchPosition))).toEqual(
      moveKeys(generateSearchLegalMoves(game)),
    )
  })

  it('apply moves and check detection consistently in the search position helpers', () => {
    const game = createCustomGame(
      [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      { turn: 'white' },
    )
    const move = generateSearchLegalMoves(game).find(
      (legalMove) => legalMove.to === 'd7',
    )

    expect(move).toBeDefined()

    const nextPositionState = applyLegalMoveState(game, move!)
    const nextSearchPosition = applySearchMove(createSearchPosition(game), move!)

    expect(
      moveKeys(generateSearchLegalMovesFromPosition(nextSearchPosition)),
    ).toEqual(moveKeys(generateSearchLegalMoves(nextPositionState)))
    expect(isSearchPositionInCheck(nextSearchPosition, nextSearchPosition.turn)).toBe(
      isInCheck(nextPositionState, nextPositionState.turn),
    )
  })

  it('preserve castling move generation and check state after applying search-position castling', () => {
    const game = createCustomGame([
      { square: 'e1', color: 'white', type: 'king' },
      { square: 'a1', color: 'white', type: 'rook' },
      { square: 'h1', color: 'white', type: 'rook' },
      { square: 'e8', color: 'black', type: 'king' },
    ])
    const move = generateSearchLegalMoves(game).find(
      (legalMove) => legalMove.from === 'e1' && legalMove.to === 'g1',
    )

    expect(move).toBeDefined()

    const nextPositionState = applyLegalMoveState(game, move!)
    const nextSearchPosition = applySearchMove(createSearchPosition(game), move!)

    expect(
      moveKeys(generateSearchLegalMovesFromPosition(nextSearchPosition)),
    ).toEqual(moveKeys(generateSearchLegalMoves(nextPositionState)))
    expect(isSearchPositionInCheck(nextSearchPosition, nextSearchPosition.turn)).toBe(
      isInCheck(nextPositionState, nextPositionState.turn),
    )
  })
})

describe('special moves', () => {
  it('supports castling and updates rook placement and rights', () => {
    const game = createCustomGame([
      { square: 'e1', color: 'white', type: 'king' },
      { square: 'a1', color: 'white', type: 'rook' },
      { square: 'h1', color: 'white', type: 'rook' },
      { square: 'e8', color: 'black', type: 'king' },
    ])

    expect(listDestinations(game, 'e1')).toContain('g1')
    expect(listDestinations(game, 'e1')).toContain('c1')

    const castled = makeMove(game, { from: 'e1', to: 'g1' })

    expect(getPieceAtSquare(castled, 'g1')).toMatchObject({
      color: 'white',
      type: 'king',
    })
    expect(getPieceAtSquare(castled, 'f1')).toMatchObject({
      color: 'white',
      type: 'rook',
    })
    expect(getPieceAtSquare(castled, 'h1')).toBeNull()
    expect(castled.castlingRights.white).toEqual({
      kingSide: false,
      queenSide: false,
    })
    expect(castled.history.at(-1)?.move.isCastling).toBe(true)
  })

  it('supports en passant captures', () => {
    const game = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
      { from: 'a7', to: 'a6' },
      { from: 'e4', to: 'e5' },
      { from: 'd7', to: 'd5' },
    ])

    const enPassantMove = generateLegalMoves(game, 'e5').find(
      (move) => move.to === 'd6',
    )

    expect(enPassantMove).toMatchObject({
      isEnPassant: true,
      isCapture: true,
    })

    const captured = makeMove(game, { from: 'e5', to: 'd6' })

    expect(getPieceAtSquare(captured, 'd6')).toMatchObject({
      color: 'white',
      type: 'pawn',
    })
    expect(getPieceAtSquare(captured, 'd5')).toBeNull()
    expect(captured.history.at(-1)?.move.capturedPiece).toMatchObject({
      color: 'black',
      type: 'pawn',
    })
  })

  it('supports promotion with an explicit promotion choice', () => {
    const game = createCustomGame([
      { square: 'e1', color: 'white', type: 'king' },
      { square: 'e8', color: 'black', type: 'king' },
      { square: 'g7', color: 'white', type: 'pawn' },
    ])

    const promotions = generateLegalMoves(game, 'g7')
      .filter((move) => move.to === 'g8')
      .map((move) => move.promotion)
      .sort()

    expect(promotions).toEqual(['bishop', 'knight', 'queen', 'rook'])

    const promoted = makeMove(game, {
      from: 'g7',
      to: 'g8',
      promotion: 'queen',
    })

    expect(getPieceAtSquare(promoted, 'g8')).toMatchObject({
      color: 'white',
      type: 'queen',
    })
    expect(promoted.history.at(-1)?.move.promotion).toBe('queen')
  })
})

describe('history', () => {
  it('stores inspectable move records and replays snapshots in order', () => {
    const game = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'g1', to: 'f3' },
    ])

    expect(game.history).toHaveLength(3)
    expect(game.history[0]?.move).toMatchObject({
      from: 'e2',
      to: 'e4',
      piece: { color: 'white', type: 'pawn' },
    })

    const replay = replayGameHistory(game)

    expect(replay).toHaveLength(4)
    expect(replay[0]?.pieces).toHaveLength(32)
    expect(
      replay[1]?.pieces.find(
        (piece) => piece.square === 'e4' && piece.type === 'pawn',
      ),
    ).toBeDefined()
    expect(
      replay.at(-1)?.pieces.find(
        (piece) => piece.square === 'f3' && piece.type === 'knight',
      ),
    ).toBeDefined()
  })
})

describe('applyLegalMove', () => {
  it('projects the same next position as makeMove without recording history', () => {
    const game = playMoves(createChessGame(), [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
    ])
    const legalMove = generateLegalMoves(game, 'g1').find(
      (move) => move.to === 'f3',
    )

    expect(legalMove).toBeDefined()

    const projected = applyLegalMove(game, legalMove!)
    const recorded = makeMove(game, {
      from: 'g1',
      to: 'f3',
    })

    expect(projected).toEqual({
      ...recorded,
      history: [],
    })
  })
})

describe('createChessPositionKey', () => {
  it('serializes equivalent positions deterministically regardless of input piece order', () => {
    const firstGame = createChessGame({
      pieces: [
        { square: 'g1', color: 'white', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd7', color: 'black', type: 'rook' },
      ],
      turn: 'white',
      castlingRights: {
        white: { kingSide: false, queenSide: false },
        black: { kingSide: false, queenSide: false },
      },
    })
    const secondGame = createChessGame({
      pieces: [
        { square: 'd7', color: 'black', type: 'rook' },
        { square: 'g8', color: 'black', type: 'king' },
        { square: 'd4', color: 'white', type: 'queen' },
        { square: 'g1', color: 'white', type: 'king' },
      ],
      turn: 'white',
      castlingRights: {
        white: { kingSide: false, queenSide: false },
        black: { kingSide: false, queenSide: false },
      },
    })

    expect(createChessPositionKey(firstGame)).toBe(
      createChessPositionKey(secondGame),
    )
  })

  it('changes when the underlying position changes after a move', () => {
    const game = createChessGame()
    const nextGame = makeMove(game, { from: 'e2', to: 'e4' })

    expect(createChessPositionKey(nextGame)).not.toBe(createChessPositionKey(game))
  })
})
