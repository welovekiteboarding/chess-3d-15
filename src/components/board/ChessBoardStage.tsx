import { ChessBoardScene } from '../../scene/ChessBoardScene'
import { startingPieceLayout } from '../../scene/pieceLayout'

const whitePieceCount = startingPieceLayout.filter(
  (piece) => piece.color === 'white',
).length
const blackPieceCount = startingPieceLayout.filter(
  (piece) => piece.color === 'black',
).length

export function ChessBoardStage() {
  return (
    <section
      className="viewport-card board-stage"
      aria-labelledby="game-shell-heading"
    >
      <div className="viewport-card__copy board-stage__copy">
        <div>
          <p className="eyebrow">3D board foundation</p>
          <h2 id="game-shell-heading">Game Shell</h2>
          <p className="body-copy">
            A responsive opening scene with mapped board squares, orbit camera
            controls, shadow-casting pieces, and the full 32-piece starting
            formation.
          </p>
        </div>

        <div className="scene-stat-list" aria-label="Scene details">
          <article className="scene-stat">
            <span className="scene-stat__value">32</span>
            <span className="scene-stat__label">Opening pieces</span>
          </article>
          <article className="scene-stat">
            <span className="scene-stat__value">
              {whitePieceCount}/{blackPieceCount}
            </span>
            <span className="scene-stat__label">White / black</span>
          </article>
          <article className="scene-stat">
            <span className="scene-stat__value">a1 - h8</span>
            <span className="scene-stat__label">Square mapping ready</span>
          </article>
        </div>
      </div>

      <div
        aria-label="Interactive 3D chess board"
        className="board-stage__viewport"
        role="img"
      >
        <ChessBoardScene pieces={startingPieceLayout} />
        <div className="board-stage__caption">Drag to orbit. Scroll to zoom.</div>
      </div>
    </section>
  )
}
