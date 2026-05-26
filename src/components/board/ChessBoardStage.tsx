import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getPieceAtSquare } from '../../chess/engine'
import {
  type ChessAnimatedPieceMotion,
  CHESS_MOVE_ANIMATION_DURATION_MS,
  createChessMoveAnimations,
  filterScenePiecesForAnimation,
} from '../game/chessMoveAnimations'
import {
  normalizeChessSquareSelectPointerType,
  resolveChessHandledSquareSelectTimestampMs,
  shouldIgnoreDuplicateSquareSelect,
  type ChessHandledSquareSelect,
  type ChessSquareSelectInput,
} from '../../input/chessInputDeduplication'
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
const LINEAR_ISSUE_ID = 'C31-30'
const GRAPH_TASK_ID = 'chess-008a'

type InteractionFeedbackTone = 'idle' | 'invalid'

interface ChessBoardStageProps {
  initialGame?: ChessGameState
  binding?: ChessSceneBinding
  controls?: ReactNode
}

export function ChessBoardStage({
  initialGame,
  binding,
  controls,
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
  const [animatedPieces, setAnimatedPieces] = useState<
    ReadonlyArray<ChessAnimatedPieceMotion>
  >([])
  const previousMoveIndexRef = useRef(0)
  const previousSquareSelectRef = useRef<ChessHandledSquareSelect | null>(null)
  const relativeEventTimestampOffsetRef = useRef<number | null>(null)
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  useEffect(() => {
    const initialSnapshot = sceneBinding.getSnapshot()
    const initialGame = sceneBinding.getGame()

    if (animationTimeoutRef.current !== null) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }
    previousMoveIndexRef.current =
      initialGame.history[initialGame.history.length - 1]?.index ?? 0
    previousSquareSelectRef.current = null
    relativeEventTimestampOffsetRef.current = null
    setSnapshot(initialSnapshot)
    setInteractionState((current) =>
      syncChessInteractionState(initialGame, current),
    )
    setInteractionFeedbackTone('idle')
    setAnimatedPieces([])

    return sceneBinding.subscribe((nextSnapshot) => {
      const nextGame = sceneBinding.getGame()
      const lastRecord = nextGame.history[nextGame.history.length - 1] ?? null
      const latestMoveIndex = lastRecord?.index ?? 0
      const previousMoveIndex = previousMoveIndexRef.current

      setSnapshot(nextSnapshot)
      setInteractionState((current) =>
        syncChessInteractionState(nextGame, current),
      )
      setInteractionFeedbackTone('idle')
      setAnimatedPieces((currentAnimatedPieces) => {
        if (lastRecord === null) {
          return []
        }

        return latestMoveIndex === previousMoveIndex
          ? currentAnimatedPieces
          : createChessMoveAnimations(nextSnapshot, lastRecord)
      })
      previousMoveIndexRef.current = latestMoveIndex
    })
  }, [sceneBinding])

  useEffect(() => {
    if (animationTimeoutRef.current !== null) {
      clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = null
    }

    if (animatedPieces.length === 0) {
      return
    }

    animationTimeoutRef.current = setTimeout(() => {
      setAnimatedPieces([])
      animationTimeoutRef.current = null
    }, CHESS_MOVE_ANIMATION_DURATION_MS)

    return () => {
      if (animationTimeoutRef.current !== null) {
        clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = null
      }
    }
  }, [animatedPieces])

  const { turnLabel, statusLabel, statusDetail } = useMemo(
    () => describeChessSceneStatus(snapshot),
    [snapshot],
  )
  const visiblePieces = useMemo(
    () => filterScenePiecesForAnimation(snapshot.pieces, animatedPieces),
    [animatedPieces, snapshot.pieces],
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

  function handleSquareSelect(
    square: ChessSquare,
    input?: ChessSquareSelectInput,
  ) {
    const game = sceneBinding.getGame()
    const timestampResolution = resolveChessHandledSquareSelectTimestampMs(
      input?.timestampMs,
      Date.now(),
      relativeEventTimestampOffsetRef.current,
    )

    relativeEventTimestampOffsetRef.current =
      timestampResolution.relativeEventTimestampOffsetMs

    const handledSelection: ChessHandledSquareSelect = {
      square,
      timestampMs: timestampResolution.timestampMs,
      source: input?.source ?? 'pointerdown',
      pointerType: normalizeChessSquareSelectPointerType(input?.pointerType),
    }

    if (
      shouldIgnoreDuplicateSquareSelect(
        previousSquareSelectRef.current,
        handledSelection,
      )
    ) {
      return
    }

    previousSquareSelectRef.current = handledSelection
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
          animatedPieces={animatedPieces}
          highlightedSquares={sceneHighlights}
          onSquareSelect={handleSquareSelect}
          pieces={visiblePieces}
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
            <dt>Input surface</dt>
            <dd>
              <code>src/input</code>
            </dd>
          </div>
          <div className="board-stage__fact">
            <dt>Layout helper</dt>
            <dd>
              <code>{`${DEMO_SQUARE} -> [${demoPosition.join(', ')}]`}</code>
            </dd>
          </div>
        </dl>

        <p className="board-stage__callout">
          Graph task <code>{GRAPH_TASK_ID}</code> adds the hint request seam so
          the board can surface the recommended source and destination squares
          for the current turn.
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

        {controls}
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
