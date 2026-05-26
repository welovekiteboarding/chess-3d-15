import { createChessGame, makeMove } from '../chess/engine'
import type {
  ChessGameState,
  ChessSceneBinding,
  ChessSceneLastMove,
  ChessSceneListener,
  ChessSceneSnapshot,
  MoveInput,
} from '../types/chess'

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
