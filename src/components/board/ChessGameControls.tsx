import { createChessGameControlsState } from '../../chess/gameControls'
import type { ChessGameState } from '../../types/chess'

const LINEAR_ISSUE_ID = 'C31-37'
const GRAPH_TASK_ID = 'chess-009a'

interface ChessGameControlsProps {
  game: ChessGameState
  onRestart: () => void
  onResign: () => void
}

export function ChessGameControls({
  game,
  onRestart,
  onResign,
}: ChessGameControlsProps) {
  const controlsState = createChessGameControlsState(game)
  const detail = controlsState.canResign
    ? 'Restart the current match or resign from the current seat.'
    : 'This match is over. Restart to begin from the original setup again.'

  return (
    <section
      aria-labelledby="game-controls-title"
      className="board-stage__feedback"
    >
      <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
      <p className="board-stage__feedback-title" id="game-controls-title">
        Game controls
      </p>
      <p className="board-stage__feedback-detail">{detail}</p>
      <p className="board-stage__feedback-detail">
        {`Graph task ${GRAPH_TASK_ID} lays down the restart and resignation seam ahead of undo and move-history work.`}
      </p>
      <div className="board-stage__selection-grid">
        <button
          className="board-stage__selection-option"
          onClick={onRestart}
          type="button"
        >
          Restart game
        </button>
        <button
          className="board-stage__selection-option"
          disabled={!controlsState.canResign}
          onClick={onResign}
          type="button"
        >
          Resign game
        </button>
      </div>
    </section>
  )
}
