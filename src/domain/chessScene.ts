import { createChessGame, makeMove } from '../chess/engine'
import { oppositeColor } from './chessboard'
import type {
  ChessGameState,
  ChessSceneBinding,
  ChessSceneLastMove,
  ChessSceneListener,
  ChessSceneSnapshot,
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
  let game = initialGame
  const listeners = new Set<ChessSceneListener>()

  return {
    getGame() {
      return game
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
      const checkedColor = formatColor(snapshot.checkedColor ?? snapshot.turn)

      return {
        turnLabel: `${activeColorLabel} to move`,
        statusLabel: `${checkedColor} is in check`,
        statusDetail: `${activeColorLabel} must answer the threat on this turn.`,
      }
    }
    case 'checkmate': {
      const winner = formatColor(snapshot.winner ?? oppositeColor(snapshot.turn))

      return {
        turnLabel: `${activeColorLabel} to move`,
        statusLabel: 'Checkmate',
        statusDetail: `${winner} wins. ${activeColorLabel} has no legal move to escape check.`,
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
    listener(snapshot)
  }
}

function formatColor(color: PieceColor): string {
  return color[0]!.toUpperCase() + color.slice(1)
}
