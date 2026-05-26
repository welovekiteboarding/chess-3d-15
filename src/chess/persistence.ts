import { createChessSceneBinding } from '../domain/chessScene'
import {
  clearStoredJsonValue,
  loadStoredJsonValue,
  resolveBrowserStorage,
  saveStoredJsonValue,
  type StorageLike,
} from '../persistence/browserStorage'
import { createChessGame, resolveChessPositionSnapshot } from './engine'
import type {
  CastlingRights,
  CastlingRightsByColor,
  ChessGameState,
  ChessMove,
  ChessMoveRecord,
  ChessPiece,
  ChessPiecePlacement,
  ChessPositionSnapshot,
  ChessSceneBinding,
  ChessSceneListener,
  ChessSceneSnapshot,
  ChessSquare,
  GameStatus,
  MoveInput,
  PieceColor,
  PieceType,
  PromotionPieceType,
} from '../types/chess'

export const CHESS_LOCAL_GAME_STORAGE_KEY = 'chess-3d:current-game'
export const CHESS_LOCAL_GAME_PERSISTENCE_VERSION = 1

export interface PersistedChessGameEnvelopeV1 {
  version: typeof CHESS_LOCAL_GAME_PERSISTENCE_VERSION
  game: ChessGameState
}

export interface ChessGamePersistence {
  load(): ChessGameState | null
  save(game: ChessGameState): void
  clear(): void
}

export interface CreateChessGamePersistenceOptions {
  storage?: StorageLike | null
  storageKey?: string
}

export interface CreatePersistedChessSceneBindingOptions {
  initialGame?: ChessGameState
  persistence?: ChessGamePersistence
}

const PIECE_COLORS: PieceColor[] = ['white', 'black']
const PIECE_TYPES: PieceType[] = [
  'king',
  'queen',
  'rook',
  'bishop',
  'knight',
  'pawn',
]
const PROMOTION_PIECE_TYPES: PromotionPieceType[] = [
  'queen',
  'rook',
  'bishop',
  'knight',
]
const GAME_STATUSES: GameStatus[] = [
  'active',
  'check',
  'checkmate',
  'stalemate',
  'draw',
  'resigned',
]
const CHESS_SQUARE_PATTERN = /^[a-h][1-8]$/

export function createChessGamePersistence(
  options: CreateChessGamePersistenceOptions = {},
): ChessGamePersistence {
  const storage = resolveBrowserStorage(options.storage)
  const storageKey = options.storageKey ?? CHESS_LOCAL_GAME_STORAGE_KEY

  return {
    load() {
      return loadStoredJsonValue(storage, storageKey, readPersistedChessGame)
    },
    save(game) {
      saveStoredJsonValue(storage, storageKey, createPersistedChessGame(game))
    },
    clear() {
      clearStoredJsonValue(storage, storageKey)
    },
  }
}

export function createPersistedChessSceneBinding(
  options: CreatePersistedChessSceneBindingOptions = {},
): ChessSceneBinding {
  const persistence = options.persistence ?? createChessGamePersistence()
  const startingGame = cloneChessGameState(
    options.initialGame ?? createChessGame(),
  )
  const restoredGame = persistence.load()
  const listeners = new Set<ChessSceneListener>()
  let activeBinding = createChessSceneBinding(restoredGame ?? startingGame)
  let unsubscribeFromActiveBinding = subscribeToPersistedBinding(
    activeBinding,
    listeners,
    persistence,
  )

  return {
    getGame() {
      return activeBinding.getGame()
    },
    getSnapshot() {
      return activeBinding.getSnapshot()
    },
    move(input) {
      return activeBinding.move(input)
    },
    undo(plies = 1) {
      return activeBinding.undo(plies)
    },
    restart() {
      unsubscribeFromActiveBinding()
      activeBinding = createChessSceneBinding(startingGame)
      unsubscribeFromActiveBinding = subscribeToPersistedBinding(
        activeBinding,
        listeners,
        persistence,
      )

      return activeBinding.getSnapshot()
    },
    resign(resignedColor) {
      return activeBinding.resign(resignedColor)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(activeBinding.getSnapshot())

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function subscribeToPersistedBinding(
  binding: ChessSceneBinding,
  listeners: Set<ChessSceneListener>,
  persistence: ChessGamePersistence,
): () => void {
  return binding.subscribe((snapshot) => {
    persistence.save(binding.getGame())
    notifyChessSceneListeners(listeners, snapshot)
  })
}

function notifyChessSceneListeners(
  listeners: Set<ChessSceneListener>,
  snapshot: ChessSceneSnapshot,
): void {
  for (const listener of listeners) {
    listener(cloneChessSceneSnapshot(snapshot))
  }
}

function createPersistedChessGame(
  game: ChessGameState,
): PersistedChessGameEnvelopeV1 {
  return {
    version: CHESS_LOCAL_GAME_PERSISTENCE_VERSION,
    game: cloneChessGameState(game),
  }
}

function readPersistedChessGame(value: unknown): ChessGameState | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.version !== CHESS_LOCAL_GAME_PERSISTENCE_VERSION) {
    return null
  }

  return readChessGameState(value.game)
}

function readChessGameState(value: unknown): ChessGameState | null {
  const snapshot = readChessPositionSnapshot(value)

  if (snapshot === null || !isRecord(value) || !Array.isArray(value.history)) {
    return null
  }

  const history: ChessMoveRecord[] = []

  for (const record of value.history) {
    const nextRecord = readChessMoveRecord(record)

    if (nextRecord === null) {
      return null
    }

    history.push(nextRecord)
  }

  return {
    ...resolveChessPositionSnapshot(snapshot),
    history,
  }
}

function readChessMoveRecord(value: unknown): ChessMoveRecord | null {
  if (!isRecord(value)) {
    return null
  }

  const index = readInteger(value.index, 1)
  const input = readMoveInput(value.input)
  const move = readChessMove(value.move)
  const before = readChessPositionSnapshot(value.before)
  const after = readChessPositionSnapshot(value.after)

  if (
    index === null ||
    input === null ||
    move === null ||
    before === null ||
    after === null
  ) {
    return null
  }

  return {
    index,
    input,
    move,
    before,
    after,
  }
}

function readChessMove(value: unknown): ChessMove | null {
  if (!isRecord(value)) {
    return null
  }

  const from = readSquare(value.from)
  const to = readSquare(value.to)
  const piece = readChessPiece(value.piece)
  const capturedPiece = readNullableChessPiece(value.capturedPiece)
  const promotion = readNullablePromotionPieceType(value.promotion)
  const isCapture = readBoolean(value.isCapture)
  const isCheck = readBoolean(value.isCheck)
  const isCheckmate = readBoolean(value.isCheckmate)
  const isStalemate = readBoolean(value.isStalemate)
  const isCastling = readBoolean(value.isCastling)
  const isEnPassant = readBoolean(value.isEnPassant)
  const rookFrom = readNullableSquare(value.rookFrom)
  const rookTo = readNullableSquare(value.rookTo)

  if (
    from === null ||
    to === null ||
    piece === null ||
    capturedPiece === undefined ||
    promotion === undefined ||
    isCapture === null ||
    isCheck === null ||
    isCheckmate === null ||
    isStalemate === null ||
    isCastling === null ||
    isEnPassant === null ||
    rookFrom === undefined ||
    rookTo === undefined
  ) {
    return null
  }

  return {
    from,
    to,
    piece,
    capturedPiece,
    promotion,
    isCapture,
    isCheck,
    isCheckmate,
    isStalemate,
    isCastling,
    isEnPassant,
    rookFrom,
    rookTo,
  }
}

function readMoveInput(value: unknown): MoveInput | null {
  if (!isRecord(value)) {
    return null
  }

  const from = readSquare(value.from)
  const to = readSquare(value.to)
  const promotion = readOptionalPromotionPieceType(value.promotion)

  if (from === null || to === null || promotion === null) {
    return null
  }

  return {
    from,
    to,
    ...(promotion === undefined ? {} : { promotion }),
  }
}

function readChessPositionSnapshot(value: unknown): ChessPositionSnapshot | null {
  if (!isRecord(value)) {
    return null
  }

  const pieces = readChessPiecePlacements(value.pieces)
  const turn = readPieceColor(value.turn)
  const castlingRights = readCastlingRightsByColor(value.castlingRights)
  const enPassantTarget = readNullableSquare(value.enPassantTarget)
  const halfmoveClock = readInteger(value.halfmoveClock, 0)
  const fullmoveNumber = readInteger(value.fullmoveNumber, 1)
  const status = readGameStatus(value.status)
  const checkedColor = readNullablePieceColor(value.checkedColor)
  const winner = readNullablePieceColor(value.winner)

  if (
    pieces === null ||
    turn === null ||
    castlingRights === null ||
    enPassantTarget === undefined ||
    halfmoveClock === null ||
    fullmoveNumber === null ||
    status === null ||
    checkedColor === undefined ||
    winner === undefined
  ) {
    return null
  }

  const snapshot: ChessPositionSnapshot = {
    pieces,
    turn,
    castlingRights,
    enPassantTarget,
    halfmoveClock,
    fullmoveNumber,
    status,
    checkedColor,
    winner,
  }

  return resolveChessPositionSnapshot(snapshot)
}

function readChessPiecePlacements(value: unknown): ChessPiecePlacement[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const pieces: ChessPiecePlacement[] = []

  for (const piece of value) {
    const nextPiece = readChessPiecePlacement(piece)

    if (nextPiece === null) {
      return null
    }

    pieces.push(nextPiece)
  }

  return pieces
}

function readChessPiecePlacement(value: unknown): ChessPiecePlacement | null {
  if (!isRecord(value)) {
    return null
  }

  const square = readSquare(value.square)
  const color = readPieceColor(value.color)
  const type = readPieceType(value.type)

  if (square === null || color === null || type === null) {
    return null
  }

  return {
    square,
    color,
    type,
  }
}

function readChessPiece(value: unknown): ChessPiece | null {
  if (!isRecord(value)) {
    return null
  }

  const color = readPieceColor(value.color)
  const type = readPieceType(value.type)

  if (color === null || type === null) {
    return null
  }

  return {
    color,
    type,
  }
}

function readNullableChessPiece(value: unknown): ChessPiece | null | undefined {
  if (value === null) {
    return null
  }

  return readChessPiece(value)
}

function readCastlingRightsByColor(
  value: unknown,
): CastlingRightsByColor | null {
  if (!isRecord(value)) {
    return null
  }

  const white = readCastlingRights(value.white)
  const black = readCastlingRights(value.black)

  if (white === null || black === null) {
    return null
  }

  return {
    white,
    black,
  }
}

function readCastlingRights(value: unknown): CastlingRights | null {
  if (!isRecord(value)) {
    return null
  }

  const kingSide = readBoolean(value.kingSide)
  const queenSide = readBoolean(value.queenSide)

  if (kingSide === null || queenSide === null) {
    return null
  }

  return {
    kingSide,
    queenSide,
  }
}

function readPieceColor(value: unknown): PieceColor | null {
  return readOneOf(PIECE_COLORS, value)
}

function readNullablePieceColor(value: unknown): PieceColor | null | undefined {
  if (value === null) {
    return null
  }

  return readPieceColor(value)
}

function readPieceType(value: unknown): PieceType | null {
  return readOneOf(PIECE_TYPES, value)
}

function readPromotionPieceType(value: unknown): PromotionPieceType | null {
  return readOneOf(PROMOTION_PIECE_TYPES, value)
}

function readNullablePromotionPieceType(
  value: unknown,
): PromotionPieceType | null | undefined {
  if (value === null) {
    return null
  }

  return readPromotionPieceType(value)
}

function readOptionalPromotionPieceType(
  value: unknown,
): PromotionPieceType | null | undefined {
  if (value === undefined) {
    return undefined
  }

  return readPromotionPieceType(value)
}

function readGameStatus(value: unknown): GameStatus | null {
  return readOneOf(GAME_STATUSES, value)
}

function readSquare(value: unknown): ChessSquare | null {
  if (typeof value !== 'string' || !CHESS_SQUARE_PATTERN.test(value)) {
    return null
  }

  return value as ChessSquare
}

function readNullableSquare(value: unknown): ChessSquare | null | undefined {
  if (value === null) {
    return null
  }

  return readSquare(value)
}

function readInteger(value: unknown, minimum: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum
    ? value
    : null
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function readOneOf<T extends string>(
  allowedValues: readonly T[],
  value: unknown,
): T | null {
  return typeof value === 'string' && allowedValues.includes(value as T)
    ? (value as T)
    : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function cloneChessSceneSnapshot(
  snapshot: ChessSceneSnapshot,
): ChessSceneSnapshot {
  return {
    pieces: snapshot.pieces.map(cloneChessPiecePlacement),
    turn: snapshot.turn,
    status: snapshot.status,
    checkedColor: snapshot.checkedColor,
    winner: snapshot.winner,
    lastMove:
      snapshot.lastMove === null
        ? null
        : {
            from: snapshot.lastMove.from,
            to: snapshot.lastMove.to,
            promotion: snapshot.lastMove.promotion,
          },
  }
}

function cloneChessGameState(game: ChessGameState): ChessGameState {
  return {
    ...cloneChessPositionSnapshot(game),
    history: game.history.map(cloneChessMoveRecord),
  }
}

function cloneChessMoveRecord(record: ChessMoveRecord): ChessMoveRecord {
  return {
    index: record.index,
    input: cloneMoveInput(record.input),
    move: cloneChessMove(record.move),
    before: cloneChessPositionSnapshot(record.before),
    after: cloneChessPositionSnapshot(record.after),
  }
}

function cloneChessMove(move: ChessMove): ChessMove {
  return {
    from: move.from,
    to: move.to,
    piece: cloneChessPiece(move.piece),
    capturedPiece:
      move.capturedPiece === null ? null : cloneChessPiece(move.capturedPiece),
    promotion: move.promotion,
    isCapture: move.isCapture,
    isCheck: move.isCheck,
    isCheckmate: move.isCheckmate,
    isStalemate: move.isStalemate,
    isCastling: move.isCastling,
    isEnPassant: move.isEnPassant,
    rookFrom: move.rookFrom,
    rookTo: move.rookTo,
  }
}

function cloneChessPositionSnapshot(
  snapshot: ChessPositionSnapshot,
): ChessPositionSnapshot {
  return {
    pieces: snapshot.pieces.map(cloneChessPiecePlacement),
    turn: snapshot.turn,
    castlingRights: {
      white: { ...snapshot.castlingRights.white },
      black: { ...snapshot.castlingRights.black },
    },
    enPassantTarget: snapshot.enPassantTarget,
    halfmoveClock: snapshot.halfmoveClock,
    fullmoveNumber: snapshot.fullmoveNumber,
    status: snapshot.status,
    checkedColor: snapshot.checkedColor,
    winner: snapshot.winner,
  }
}

function cloneChessPiecePlacement(
  piece: ChessPiecePlacement,
): ChessPiecePlacement {
  return {
    square: piece.square,
    color: piece.color,
    type: piece.type,
  }
}

function cloneChessPiece(piece: ChessPiece): ChessPiece {
  return {
    color: piece.color,
    type: piece.type,
  }
}

function cloneMoveInput(input: MoveInput): MoveInput {
  return {
    from: input.from,
    to: input.to,
    ...(input.promotion === undefined ? {} : { promotion: input.promotion }),
  }
}
