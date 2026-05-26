import {
  createChessCapturedPiecesBySide,
  createChessGameControlsState,
  createChessMoveHistory,
} from '../../chess/gameControls'
import type { ChessGameState, ChessPiece, PieceColor } from '../../types/chess'

const LINEAR_ISSUE_ID = 'C31-38'
const GRAPH_TASK_ID = 'chess-009b'

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
  const moveHistory = createChessMoveHistory(game)
  const capturedPieces = createChessCapturedPiecesBySide(game)
  const detail = controlsState.canResign
    ? 'Restart the current match, resign from the current seat, and review the live move ledger.'
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
        {`Graph task ${GRAPH_TASK_ID} adds readable move history and captured-piece tracking on top of the restart and resignation controls.`}
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
      <div className="board-stage__capture-grid">
        <div className="board-stage__capture-group">
          <p className="board-stage__feedback-title">Move history</p>
          <ol aria-label="Move history" className="board-stage__history-list">
            {moveHistory.length === 0 ? (
              <li className="board-stage__history-item">No moves yet.</li>
            ) : (
              moveHistory.map((entry) => (
                <li
                  className="board-stage__history-item"
                  key={entry.index}
                >{`${entry.index}. ${formatColor(entry.color)}: ${entry.notation}`}</li>
              ))
            )}
          </ol>
        </div>
        <div className="board-stage__capture-group">
          <p className="board-stage__feedback-title">Captured pieces</p>
          <div className="board-stage__capture-grid">
            <div className="board-stage__capture-group">
              <p className="board-stage__capture-label">White captured</p>
              <p className="board-stage__feedback-detail">
                {formatCapturedPieces(capturedPieces.white)}
              </p>
            </div>
            <div className="board-stage__capture-group">
              <p className="board-stage__capture-label">Black captured</p>
              <p className="board-stage__feedback-detail">
                {formatCapturedPieces(capturedPieces.black)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function formatCapturedPieces(pieces: ChessPiece[]): string {
  if (pieces.length === 0) {
    return 'None'
  }

  return pieces.map((piece) => formatPieceType(piece.type)).join(', ')
}

function formatColor(color: PieceColor): string {
  return color[0]!.toUpperCase() + color.slice(1)
}

function formatPieceType(pieceType: ChessPiece['type']): string {
  return pieceType[0]!.toUpperCase() + pieceType.slice(1)
}
