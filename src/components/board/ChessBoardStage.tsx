import { useEffect, useMemo, useState } from 'react'
import {
  createChessSceneBinding,
  describeChessSceneStatus,
} from '../../domain/chessScene'
import { ChessScene } from '../../scene/ChessScene'
import { squareToScenePosition } from '../../scene/boardCoordinates'
import type { ChessGameState, ChessSceneBinding } from '../../types/chess'

const DEMO_SQUARE = 'e4'
const demoPosition = squareToScenePosition(DEMO_SQUARE)
const LINEAR_ISSUE_ID = 'C31-24'
const GRAPH_TASK_ID = 'chess-004d'

interface ChessBoardStageProps {
  initialGame?: ChessGameState
  binding?: ChessSceneBinding
}

export function ChessBoardStage({
  initialGame,
  binding,
}: ChessBoardStageProps) {
  const sceneBinding = useMemo(
    () => binding ?? createChessSceneBinding(initialGame),
    [binding, initialGame],
  )
  const [snapshot, setSnapshot] = useState(() => sceneBinding.getSnapshot())

  useEffect(() => {
    setSnapshot(sceneBinding.getSnapshot())

    return sceneBinding.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot)
    })
  }, [sceneBinding])

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

      <aside
        aria-atomic="true"
        aria-live="polite"
        className="board-stage__rail"
      >
        <div>
          <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
          <h2 id="board-stage-title">{turnLabel}</h2>
          <p className="body-copy">{statusDetail}</p>
        </div>

        <div className="board-stage__notes" role="list">
          <span className="board-chip" role="listitem">
            Engine binding live
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
            <dt>Graph task</dt>
            <dd>
              <code>{GRAPH_TASK_ID}</code>
            </dd>
          </div>
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
          Graph task <code>{GRAPH_TASK_ID}</code> wires the engine binding into
          the live 3D board surface so turn, status, and move history stay in
          sync with the rendered position.
        </p>
      </aside>
    </section>
  )
}
