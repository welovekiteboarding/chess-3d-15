import {
  createChessGameControlsState,
} from '../../chess/gameControls'
import { ChessMoveHistory } from '../history/ChessMoveHistory'
import type { ChessGameState } from '../../types/chess'

const LINEAR_ISSUE_ID = 'C31-39'
const GRAPH_TASK_ID = 'chess-009c'

interface ChessGameControlsProps {
  game: ChessGameState
  onUndo: () => void
  onRestart: () => void
  onResign: () => void
}

export function ChessGameControls({
  game,
  onUndo,
  onRestart,
  onResign,
}: ChessGameControlsProps) {
  const controlsState = createChessGameControlsState(game)
  const detail = controlsState.canResign
    ? 'Restart the current match, undo the latest move, resign from the current seat, and review the live move ledger.'
    : controlsState.canUndo
      ? 'This match is over. Undo the latest move or restart from the original setup.'
      : 'This match is over. Restart to begin from the original setup again.'

  return (
    <section
      aria-labelledby="game-controls-title"
      className="board-stage__feedback board-stage__feedback--control"
    >
      <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
      <p className="board-stage__feedback-title" id="game-controls-title">
        Game controls
      </p>
      <p className="board-stage__feedback-detail">{detail}</p>
      <p className="board-stage__feedback-detail">
        {`Graph task ${GRAPH_TASK_ID} finishes the live controls with undo availability, readable move history, and captured-piece tracking.`}
      </p>
      <div className="board-stage__button-grid">
        <button
          className="board-stage__action-button"
          disabled={!controlsState.canRestart}
          onClick={onRestart}
          type="button"
        >
          Restart game
        </button>
        <button
          className="board-stage__action-button"
          disabled={!controlsState.canUndo}
          onClick={onUndo}
          type="button"
        >
          Undo move
        </button>
        <button
          className="board-stage__action-button"
          disabled={!controlsState.canResign}
          onClick={onResign}
          type="button"
        >
          Resign game
        </button>
      </div>
      <ChessMoveHistory game={game} />
    </section>
  )
}
