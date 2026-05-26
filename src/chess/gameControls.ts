import { oppositeColor } from '../domain/chessboard'
import type {
  ChessGameState,
  ChessMove,
  ChessMoveRecord,
  ChessPositionSnapshot,
  GameStatus,
  PieceColor,
} from '../types/chess'

export interface ChessGameControlsState {
  canRestart: boolean
  canResign: boolean
  canUndo: boolean
}

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
    canUndo: false,
  }
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
