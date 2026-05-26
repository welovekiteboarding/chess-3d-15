import { oppositeColor } from '../domain/chessboard'
import type {
  ChessGameState,
  ChessMove,
  ChessMoveRecord,
  ChessPiece,
  ChessPositionSnapshot,
  GameStatus,
  PieceColor,
} from '../types/chess'

export interface ChessGameControlsState {
  canRestart: boolean
  canResign: boolean
  canUndo: boolean
}

export interface ChessMoveHistoryItem {
  index: number
  color: PieceColor
  notation: string
}

export type ChessCapturedPiecesBySide = Record<PieceColor, ChessPiece[]>

export function isChessGameTerminalStatus(status: GameStatus): boolean {
  return (
    status === 'checkmate' ||
    status === 'stalemate' ||
    status === 'draw' ||
    status === 'resigned'
  )
}

export function createChessGameControlsState(
  game: ChessGameState,
): ChessGameControlsState {
  return {
    canRestart: true,
    canResign: !isChessGameTerminalStatus(game.status),
    canUndo: game.history.length > 0 && game.status !== 'resigned',
  }
}

export function undoChessGame(
  game: ChessGameState,
  plies = 1,
): ChessGameState {
  const nextGame = cloneChessGameState(game)
  const normalizedPlies = Math.max(0, Math.trunc(plies))

  if (nextGame.history.length === 0 || normalizedPlies === 0) {
    return nextGame
  }

  const restoreIndex = Math.max(0, nextGame.history.length - normalizedPlies)
  const restoredSnapshot = nextGame.history[restoreIndex]!.before
  const remainingHistory = nextGame.history
    .slice(0, restoreIndex)
    .map(cloneChessMoveRecord)

  return {
    ...clonePositionSnapshot(restoredSnapshot),
    history: remainingHistory,
  }
}

export function createChessMoveHistory(
  game: Pick<ChessGameState, 'history'>,
): ChessMoveHistoryItem[] {
  return game.history.map((record) => ({
    index: record.index,
    color: record.move.piece.color,
    notation: formatChessMoveRecord(record),
  }))
}

export function createChessCapturedPiecesBySide(
  game: Pick<ChessGameState, 'history'>,
): ChessCapturedPiecesBySide {
  const capturedPieces: ChessCapturedPiecesBySide = {
    white: [],
    black: [],
  }

  for (const record of game.history) {
    if (record.move.capturedPiece === null) {
      continue
    }

    capturedPieces[record.move.piece.color].push({
      ...record.move.capturedPiece,
    })
  }

  return capturedPieces
}

export function resignChessGame(
  game: ChessGameState,
  resignedColor: PieceColor = game.turn,
): ChessGameState {
  const nextGame = cloneChessGameState(game)

  if (isChessGameTerminalStatus(nextGame.status)) {
    return nextGame
  }

  return {
    ...nextGame,
    status: 'resigned',
    checkedColor: null,
    winner: oppositeColor(resignedColor),
  }
}

function cloneChessGameState(game: ChessGameState): ChessGameState {
  return {
    ...clonePositionSnapshot(game),
    history: game.history.map(cloneChessMoveRecord),
  }
}

function cloneChessMoveRecord(record: ChessMoveRecord): ChessMoveRecord {
  return {
    index: record.index,
    input: {
      from: record.input.from,
      to: record.input.to,
      ...(record.input.promotion === undefined
        ? {}
        : { promotion: record.input.promotion }),
    },
    move: cloneChessMove(record.move),
    before: clonePositionSnapshot(record.before),
    after: clonePositionSnapshot(record.after),
  }
}

function cloneChessMove(move: ChessMove): ChessMove {
  return {
    from: move.from,
    to: move.to,
    piece: { ...move.piece },
    capturedPiece:
      move.capturedPiece === null ? null : { ...move.capturedPiece },
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

function formatChessMoveRecord(record: ChessMoveRecord): string {
  const { move } = record

  if (move.isCastling) {
    const castlingSide = move.to[0] === 'g' ? 'kingside' : 'queenside'
    return `${formatPieceType(move.piece.type)} ${move.from} castles ${castlingSide}${formatMoveSuffix(
      move,
    )}`
  }

  let notation = `${formatPieceType(move.piece.type)} ${move.from} ${
    move.isCapture ? 'captures' : 'to'
  } ${move.to}`

  if (move.isEnPassant) {
    notation += ' en passant'
  }

  if (move.promotion !== null) {
    notation += ` promoting to ${formatPieceType(move.promotion)}`
  }

  return `${notation}${formatMoveSuffix(move)}`
}

function formatMoveSuffix(move: ChessMove): string {
  if (move.isCheckmate) {
    return ', checkmate'
  }

  if (move.isStalemate) {
    return ', stalemate'
  }

  if (move.isCheck) {
    return ', check'
  }

  return ''
}

function clonePositionSnapshot(
  snapshot: ChessPositionSnapshot,
): ChessPositionSnapshot {
  return {
    pieces: snapshot.pieces.map((piece) => ({ ...piece })),
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

function formatPieceType(pieceType: ChessPiece['type']): string {
  return pieceType[0]!.toUpperCase() + pieceType.slice(1)
}
