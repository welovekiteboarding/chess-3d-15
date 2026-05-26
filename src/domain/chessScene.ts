import { createChessGame, makeMove } from '../chess/engine'
import { oppositeColor } from './chessboard'
import type {
  ChessMove,
  ChessMoveRecord,
  ChessGameState,
  ChessSceneBinding,
  ChessSceneLastMove,
  ChessSceneListener,
  ChessSceneSnapshot,
  ChessPositionSnapshot,
  PieceColor,
  MoveInput,
} from '../types/chess'

export interface ChessSceneStatusSummary {
  turnLabel: string
  statusLabel: string
  statusDetail: string
}

export function createChessSceneSnapshot(
  game: ChessGameState,
): ChessSceneSnapshot {
  return {
    pieces: game.pieces.map((piece) => ({ ...piece })),
    turn: game.turn,
    status: game.status,
    checkedColor: game.checkedColor,
    winner: game.winner,
    lastMove: createLastMove(game),
  }
}

export function createChessSceneBinding(
  initialGame: ChessGameState = createChessGame(),
): ChessSceneBinding {
  let game = cloneChessGameState(initialGame)
  const listeners = new Set<ChessSceneListener>()

  return {
    getGame() {
      return cloneChessGameState(game)
    },
    getSnapshot() {
      return createChessSceneSnapshot(game)
    },
    move(input: MoveInput) {
      game = makeMove(game, input)

      const snapshot = createChessSceneSnapshot(game)
      notifyListeners(listeners, snapshot)

      return snapshot
    },
    subscribe(listener: ChessSceneListener) {
      listeners.add(listener)
      listener(createChessSceneSnapshot(game))

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function describeChessSceneStatus(
  snapshot: Pick<ChessSceneSnapshot, 'turn' | 'status' | 'checkedColor' | 'winner'>,
): ChessSceneStatusSummary {
  const activeColorLabel = formatColor(snapshot.turn)

  switch (snapshot.status) {
    case 'check': {
      const checkedColor = snapshot.checkedColor ?? snapshot.turn
      const checkedColorLabel = formatColor(checkedColor)

      return {
        turnLabel: `${checkedColorLabel} to move`,
        statusLabel: `${checkedColorLabel} is in check`,
        statusDetail: `${checkedColorLabel} must answer the threat on this turn.`,
      }
    }
    case 'checkmate': {
      const winnerColor = snapshot.winner ?? oppositeColor(snapshot.turn)
      const winner = formatColor(winnerColor)
      const losingColorLabel = formatColor(oppositeColor(winnerColor))

      return {
        turnLabel: `${losingColorLabel} to move`,
        statusLabel: 'Checkmate',
        statusDetail: `${winner} wins. ${losingColorLabel} has no legal move to escape check.`,
      }
    }
    case 'stalemate':
      return {
        turnLabel: `${activeColorLabel} to move`,
        statusLabel: 'Stalemate',
        statusDetail: `${activeColorLabel} has no legal moves, and neither king is in check.`,
      }
    case 'active':
      return {
        turnLabel: `${activeColorLabel} to move`,
        statusLabel: 'Game in progress',
        statusDetail: `${activeColorLabel} controls the next move.`,
      }
  }
}

function createLastMove(game: ChessGameState): ChessSceneLastMove | null {
  const record = game.history[game.history.length - 1]

  if (record === undefined) {
    return null
  }

  return {
    from: record.move.from,
    to: record.move.to,
    promotion: record.move.promotion,
  }
}

function notifyListeners(
  listeners: Set<ChessSceneListener>,
  snapshot: ChessSceneSnapshot,
): void {
  for (const listener of listeners) {
    listener(cloneChessSceneSnapshot(snapshot))
  }
}

function formatColor(color: PieceColor): string {
  return color[0]!.toUpperCase() + color.slice(1)
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

function cloneChessSceneSnapshot(
  snapshot: ChessSceneSnapshot,
): ChessSceneSnapshot {
  return {
    pieces: snapshot.pieces.map((piece) => ({ ...piece })),
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
