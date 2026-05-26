import {
  createChessCapturedPiecesBySide,
  createChessMoveHistory,
} from '../../chess/gameControls'
import type { ChessGameState, ChessPiece, PieceColor } from '../../types/chess'

const LINEAR_ISSUE_ID = 'C31-40'
const GRAPH_TASK_ID = 'chess-009d'

interface ChessMoveHistoryProps {
  game: Pick<ChessGameState, 'history'>
}

export function ChessMoveHistory({ game }: ChessMoveHistoryProps) {
  const moveHistory = createChessMoveHistory(game)
  const capturedPieces = createChessCapturedPiecesBySide(game)

  return (
    <div aria-labelledby="move-history-title" className="board-stage__history-shell">
      <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
      <p className="board-stage__feedback-title" id="move-history-title">
        Move history
      </p>
      <p className="board-stage__feedback-detail">
        {`Graph task ${GRAPH_TASK_ID} wires the reusable move history surface into the live game controls with captured-piece tracking.`}
      </p>

      <div className="board-stage__capture-grid">
        <div className="board-stage__capture-group">
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
    </div>
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
