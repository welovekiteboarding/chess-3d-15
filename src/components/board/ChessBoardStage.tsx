import { useMemo } from 'react'
import { createChessGame } from '../../chess/engine'
import {
  createChessSceneSnapshot,
  describeChessSceneStatus,
} from '../../domain/chessScene'
import { ChessScene } from '../../scene/ChessScene'
import { squareToScenePosition } from '../../scene/boardCoordinates'
import type { ChessGameState } from '../../types/chess'

const DEMO_SQUARE = 'e4'
const demoPosition = squareToScenePosition(DEMO_SQUARE)

interface ChessBoardStageProps {
  initialGame?: ChessGameState
}

export function ChessBoardStage({ initialGame }: ChessBoardStageProps) {
  const snapshot = useMemo(
    () => createChessSceneSnapshot(initialGame ?? createChessGame()),
    [initialGame],
  )
  const { turnLabel, statusLabel, statusDetail } = useMemo(
    () => describeChessSceneStatus(snapshot),
    [snapshot],
  )
  const lastMoveLabel = snapshot.lastMove
    ? `${snapshot.lastMove.from} -> ${snapshot.lastMove.to}${
        snapshot.lastMove.promotion === null
          ? ''
          : ` = ${snapshot.lastMove.promotion}`
      }`
    : 'Opening setup'

  return (
    <section className="board-stage" aria-labelledby="board-stage-title">
      <div className="board-stage__viewport">
        <div className="board-stage__glow" />
        <ChessScene pieces={snapshot.pieces} />
      </div>

      <aside className="board-stage__rail">
        <div>
          <p className="eyebrow">Issue C31-23</p>
          <h2 id="board-stage-title">{turnLabel}</h2>
          <p className="body-copy">{statusDetail}</p>
        </div>

        <div className="board-stage__notes" role="list">
          <span className="board-chip" role="listitem">
            Engine snapshot live
          </span>
          <span className="board-chip" role="listitem">
            {`${snapshot.pieces.length} scene pieces`}
          </span>
          <span className="board-chip" role="listitem">
            {snapshot.lastMove === null ? 'Opening position' : 'Move history live'}
          </span>
        </div>

        <dl className="board-stage__meta">
          <div className="board-stage__fact">
            <dt>Status</dt>
            <dd>{statusLabel}</dd>
          </div>
          <div className="board-stage__fact">
            <dt>Scene binding</dt>
            <dd>{`${snapshot.pieces.length} pieces rendered from engine state`}</dd>
          </div>
          <div className="board-stage__fact">
            <dt>Last move</dt>
            <dd>{lastMoveLabel}</dd>
          </div>
          <div className="board-stage__fact">
            <dt>Layout helper</dt>
            <dd>
              <code>{`${DEMO_SQUARE} -> [${demoPosition.join(', ')}]`}</code>
            </dd>
          </div>
        </dl>

        <p className="board-stage__callout">
          The board view now reads directly from the chess engine snapshot, so
          turn, check, checkmate, and stalemate states stay in sync with the
          rendered 3D position.
        </p>
      </aside>
    </section>
  )
}
