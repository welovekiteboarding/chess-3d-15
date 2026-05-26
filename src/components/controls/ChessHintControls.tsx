import { useEffect, useState } from 'react'
import {
  type ChessHint,
  createChessHintState,
  dismissChessHintState,
  showChessHintState,
  syncChessHintState,
} from '../../ai/hint'
import type { ChessGamePersistence } from '../../chess/persistence'
import type { ChessSceneBinding } from '../../types/chess'
import { ChessPersistenceControls } from './ChessPersistenceControls'

const LINEAR_ISSUE_ID = 'C31-33'
const GRAPH_TASK_ID = 'chess-008d'

interface ChessHintControlsProps {
  binding: ChessSceneBinding
  persistence?: ChessGamePersistence
}

export function ChessHintControls({
  binding,
  persistence,
}: ChessHintControlsProps) {
  const [snapshot, setSnapshot] = useState(() => binding.getSnapshot())
  const [hintState, setHintState] = useState(() => createChessHintState())

  useEffect(() => {
    setSnapshot(binding.getSnapshot())
    setHintState(createChessHintState())

    return binding.subscribe((nextSnapshot) => {
      const game = binding.getGame()

      setSnapshot(nextSnapshot)
      setHintState((current) =>
        syncChessHintState({
          state: current,
          game,
          behavior: 'replace',
        }),
      )
    })
  }, [binding])

  const canRequestHint =
    snapshot.status === 'active' || snapshot.status === 'check'
  const hintDetail =
    hintState.hint === null
      ? canRequestHint
        ? 'Request a recommended move for the current player.'
        : 'Hints are unavailable after the game ends.'
      : `Recommended move: ${formatHintLabel(hintState.hint)}`

  function handleHintToggle() {
    setHintState((current) =>
      current.isVisible
        ? dismissChessHintState()
        : showChessHintState({
            game: binding.getGame(),
          }),
    )
  }

  return (
    <>
      <ChessPersistenceControls binding={binding} persistence={persistence} />
      <section
        aria-labelledby="hint-controls-title"
        className="board-stage__feedback"
      >
        <p className="eyebrow">{`Issue ${LINEAR_ISSUE_ID}`}</p>
        <p className="board-stage__feedback-title" id="hint-controls-title">
          Hint mode
        </p>
        <p className="board-stage__feedback-detail">{hintDetail}</p>
        <p className="board-stage__feedback-detail">
          {`Graph task ${GRAPH_TASK_ID} wires the reusable hint controls into the live game shell.`}
        </p>
        <button
          disabled={!canRequestHint}
          onClick={handleHintToggle}
          type="button"
        >
          {hintState.isVisible ? 'Hide hint' : 'Show hint'}
        </button>
      </section>
    </>
  )
}

function formatHintLabel(hint: ChessHint): string {
  return `${hint.from} -> ${hint.to}${
    hint.promotion === null ? '' : ` = ${hint.promotion}`
  }`
}
