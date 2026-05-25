import { INITIAL_PIECES } from '../../assets/chessSetup'
import { ChessScene } from '../../scene/ChessScene'
import { squareToScenePosition } from '../../scene/boardCoordinates'

const DEMO_SQUARE = 'e4'
const demoPosition = squareToScenePosition(DEMO_SQUARE)

export function ChessBoardStage() {
  return (
    <section className="board-stage" aria-labelledby="board-stage-title">
      <div className="board-stage__viewport">
        <div className="board-stage__glow" />
        <ChessScene />
      </div>

      <aside className="board-stage__rail">
        <div>
          <p className="eyebrow">Issue C31-6</p>
          <h2 id="board-stage-title">Opening Position</h2>
          <p className="body-copy">
            The board foundation now renders a complete starting arrangement
            with scene lighting, shadows, responsive canvas sizing, and stable
            board-square mapping helpers for future move logic.
          </p>
        </div>

        <div className="board-stage__notes" role="list">
          <span className="board-chip" role="listitem">
            32 modeled pieces
          </span>
          <span className="board-chip" role="listitem">
            Shadow-casting lights
          </span>
          <span className="board-chip" role="listitem">
            Orbit camera controls
          </span>
        </div>

        <dl className="board-stage__meta">
          <div className="board-stage__fact">
            <dt>Pieces</dt>
            <dd>{INITIAL_PIECES.length} in standard formation</dd>
          </div>
          <div className="board-stage__fact">
            <dt>Camera</dt>
            <dd>White-side default angle with constrained orbit</dd>
          </div>
          <div className="board-stage__fact">
            <dt>Layout helper</dt>
            <dd>
              <code>{`${DEMO_SQUARE} -> [${demoPosition.join(', ')}]`}</code>
            </dd>
          </div>
        </dl>

        <p className="board-stage__callout">
          Square helpers expose deterministic scene coordinates, so later game
          state can place, animate, and select pieces without guessing where a
          square lives in 3D space.
        </p>
      </aside>
    </section>
  )
}
