import { useEffect, useMemo, useState } from 'react'
import {
  createChessSceneBinding,
  describeChessSceneStatus,
} from '../../domain/chessScene'
import { createChessSceneHighlights } from '../../scene/chessSceneHighlights'
import { ChessScene } from '../../scene/ChessScene'
import { squareToScenePosition } from '../../scene/boardCoordinates'
import {
  createChessInteractionState,
  deriveChessInteractionSnapshot,
  selectChessInteractionSquare,
  syncChessInteractionState,
} from '../../state/chessInteraction'
import type {
  ChessGameState,
  ChessSceneBinding,
  ChessSceneLastMove,
  ChessSquare,
} from '../../types/chess'

const DEMO_SQUARE = 'e4'
const demoPosition = squareToScenePosition(DEMO_SQUARE)
const LINEAR_ISSUE_ID = 'C31-25'
const GRAPH_TASK_ID = 'chess-005a'

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
  const [interactionState, setInteractionState] = useState(() =>
    createChessInteractionState(),
  )

  useEffect(() => {
    setSnapshot(sceneBinding.getSnapshot())
    setInteractionState((current) =>
      syncChessInteractionState(sceneBinding.getGame(), current),
    )

    return sceneBinding.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot)
      setInteractionState((current) =>
        syncChessInteractionState(sceneBinding.getGame(), current),
      )
    })
  }, [sceneBinding])

  const { turnLabel, statusLabel, statusDetail } = useMemo(
    () => describeChessSceneStatus(snapshot),
    [snapshot],
  )
  const interactionSnapshot = useMemo(
    () =>
      deriveChessInteractionSnapshot(sceneBinding.getGame(), interactionState),
    [interactionState, sceneBinding, snapshot],
  )
  const sceneHighlights = useMemo(
    () => createChessSceneHighlights(interactionSnapshot),
    [interactionSnapshot],
  )
  const lastMoveLabel = formatLastMoveLabel(snapshot.lastMove)
  const moveChipLabel =
    snapshot.lastMove === null ? 'Opening position' : `Last move: ${lastMoveLabel}`

  function handleSquareSelect(square: ChessSquare) {
    setInteractionState((current) =>
      selectChessInteractionSquare(sceneBinding.getGame(), current, square),
    )
  }

  return (
    <section className="board-stage" aria-labelledby="board-stage-title">
      <div className="board-stage__viewport">
        <div className="board-stage__glow" />
        <ChessScene
          highlightedSquares={sceneHighlights}
          onSquareSelect={handleSquareSelect}
          pieces={snapshot.pieces}
          selectedSquare={interactionSnapshot.selectedSquare}
        />
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
            {statusLabel}
          </span>
          <span className="board-chip" role="listitem">
            {`${snapshot.pieces.length} scene pieces`}
          </span>
          <span className="board-chip" role="listitem">
            {moveChipLabel}
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
          Graph task <code>{GRAPH_TASK_ID}</code> adds the first interaction
          seam so piece selection and legal-destination highlights stay in sync
          with the rendered position.
        </p>
      </aside>
    </section>
  )
}

function formatLastMoveLabel(lastMove: ChessSceneLastMove | null): string {
  if (lastMove === null) {
    return 'Opening setup'
  }

  return `${lastMove.from} -> ${lastMove.to}${
    lastMove.promotion === null ? '' : ` = ${lastMove.promotion}`
  }`
}
