import { useEffect, useMemo, useState } from 'react'
import { getPieceAtSquare } from '../../chess/engine'
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
const LINEAR_ISSUE_ID = 'C31-8'
const GRAPH_TASK_ID = 'chess-004'

type InteractionFeedbackTone = 'idle' | 'invalid'

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
  const [interactionFeedbackTone, setInteractionFeedbackTone] =
    useState<InteractionFeedbackTone>('idle')

  useEffect(() => {
    setSnapshot(sceneBinding.getSnapshot())
    setInteractionState((current) =>
      syncChessInteractionState(sceneBinding.getGame(), current),
    )
    setInteractionFeedbackTone('idle')

    return sceneBinding.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot)
      setInteractionState((current) =>
        syncChessInteractionState(sceneBinding.getGame(), current),
      )
      setInteractionFeedbackTone('idle')
    })
  }, [sceneBinding])

  const { turnLabel, statusLabel, statusDetail } = useMemo(
    () => describeChessSceneStatus(snapshot),
    [snapshot],
  )
  const interactionSnapshot = useMemo(
    () =>
      deriveChessInteractionSnapshot(sceneBinding.getGame(), interactionState),
    [interactionState, sceneBinding],
  )
  const sceneHighlights = useMemo(
    () => createChessSceneHighlights(interactionSnapshot),
    [interactionSnapshot],
  )
  const interactionFeedback = useMemo(() => {
    if (interactionFeedbackTone === 'invalid') {
      return {
        title: 'Illegal move blocked',
        detail: 'Choose one of the highlighted destinations to move.',
      }
    }

    if (interactionSnapshot.selectedSquare === null) {
      return {
        title: 'Select a piece',
        detail: 'Click or tap one of the active side pieces to reveal legal moves.',
      }
    }

    return {
      title: `Selected ${interactionSnapshot.selectedSquare}`,
      detail: interactionSnapshot.legalTargets.some(
        (target) => target.kind === 'capture',
      )
        ? 'Capture destinations are highlighted separately from quiet moves.'
        : 'Choose a highlighted square to move, or select another piece.',
    }
  }, [interactionFeedbackTone, interactionSnapshot])
  const lastMoveLabel = formatLastMoveLabel(snapshot.lastMove)
  const moveChipLabel =
    snapshot.lastMove === null ? 'Opening position' : `Last move: ${lastMoveLabel}`

  function handleSquareSelect(square: ChessSquare) {
    const game = sceneBinding.getGame()
    const activePiece = getPieceAtSquare(game, square)
    const selectedSquare = interactionSnapshot.selectedSquare
    const requestedMove = interactionSnapshot.legalTargets.find(
      (target) => target.square === square,
    )

    if (selectedSquare !== null && requestedMove !== undefined) {
      setInteractionFeedbackTone('idle')
      sceneBinding.move({
        from: selectedSquare,
        to: square,
      })
      return
    }

    if (activePiece !== null && activePiece.color === game.turn) {
      setInteractionFeedbackTone('idle')
      setInteractionState((current) =>
        selectChessInteractionSquare(game, current, square),
      )
      return
    }

    if (selectedSquare === null) {
      setInteractionFeedbackTone('idle')
      return
    }

    setInteractionFeedbackTone('invalid')
  }

  return (
    <section className="board-stage" aria-labelledby="board-stage-title">
      <div
        className={`board-stage__viewport${
          interactionFeedbackTone === 'invalid'
            ? ' board-stage__viewport--invalid'
            : ''
        }`}
      >
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
          Graph task <code>{GRAPH_TASK_ID}</code> connects live chess engine
          state to the 3D board so piece renders, captures, promotions, and
          turn status all stay in sync.
        </p>

        <div
          className={`board-stage__feedback${
            interactionFeedbackTone === 'invalid'
              ? ' board-stage__feedback--invalid'
              : ''
          }`}
        >
          <p className="board-stage__feedback-title">{interactionFeedback.title}</p>
          <p className="board-stage__feedback-detail">
            {interactionFeedback.detail}
          </p>
        </div>
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
