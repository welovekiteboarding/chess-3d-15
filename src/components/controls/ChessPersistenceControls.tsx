import { useEffect, useState } from 'react'
import type { ChessGamePersistence } from '../../chess/persistence'
import type { ChessGameState, ChessMove, ChessSceneBinding } from '../../types/chess'

const LINEAR_ISSUE_ID = 'C31-46'
const GRAPH_TASK_ID = 'chess-012d'

interface ChessPersistenceControlsProps {
  binding: ChessSceneBinding
  persistence?: ChessGamePersistence
}

export function ChessPersistenceControls({
  binding,
  persistence,
}: ChessPersistenceControlsProps) {
  const [game, setGame] = useState(() => binding.getGame())
  const [hasSavedGame, setHasSavedGame] = useState(() =>
    checkForSavedGame(binding.getGame(), persistence),
  )

  useEffect(() => {
    const currentGame = binding.getGame()

    setGame(currentGame)
    setHasSavedGame(checkForSavedGame(currentGame, persistence))

    return binding.subscribe(() => {
      const nextGame = binding.getGame()

      setGame(nextGame)
      setHasSavedGame(checkForSavedGame(nextGame, persistence))
    })
  }, [binding, persistence])

  const detail = hasSavedGame
    ? formatSavedGameDetail(game.history[game.history.length - 1]?.move ?? null, {
        moveCount: game.history.length,
      })
    : 'No saved game is stored yet. Your first move will create a local save on this device.'
  const subdetail = hasSavedGame
    ? 'Reloading this page restores the current position. Clear saved game discards the local session and resets this board to its starting setup.'
    : "Reloading now starts from this board's starting setup."

  function handleClearSavedGame() {
    if (!hasSavedGame) {
      return
    }

    try {
      persistence?.clear()
    } catch {
      // Keep the reset action available even if storage cleanup fails here.
    }

    binding.restart()
  }

  return (
    <section
      aria-labelledby="persistence-controls-title"
      className="board-stage__feedback"
    >
      <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
      <p
        className="board-stage__feedback-title"
        id="persistence-controls-title"
      >
        Local session
      </p>
      <p className="board-stage__feedback-detail">{detail}</p>
      <p className="board-stage__feedback-detail">{subdetail}</p>
      <p className="board-stage__feedback-detail">
        {`Graph task ${GRAPH_TASK_ID} wires autosave, reload restore, and safe local-session clearing into the live controls rail.`}
      </p>
      <button
        disabled={!hasSavedGame}
        onClick={handleClearSavedGame}
        type="button"
      >
        Clear saved game
      </button>
    </section>
  )
}

function checkForSavedGame(
  game: ChessGameState,
  persistence: ChessGamePersistence | undefined,
): boolean {
  if (persistence !== undefined) {
    try {
      return persistence.load() !== null
    } catch {
      return false
    }
  }

  return game.history.length > 0 || game.status === 'resigned'
}

function formatMoveCount(moveCount: number): string {
  return `${moveCount} ${moveCount === 1 ? 'move' : 'moves'}`
}

function formatSavedGameDetail(
  lastMove: ChessMove | null,
  options: { moveCount: number },
): string {
  if (lastMove === null) {
    return 'This session is saved locally and will be restored after a reload.'
  }

  return `Saved locally after ${formatMoveCount(options.moveCount)}${formatLastMoveSuffix(
    lastMove,
  )}.`
}

function formatLastMoveSuffix(lastMove: ChessMove | null): string {
  if (lastMove === null) {
    return ''
  }

  return `: ${lastMove.from} -> ${lastMove.to}${
    lastMove.promotion === null ? '' : ` = ${lastMove.promotion}`
  }`
}
