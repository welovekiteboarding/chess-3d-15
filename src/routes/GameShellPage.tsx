import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessBoardStage />

      <div className="game-shell-page__footer">
        <p className="body-copy">
          Graph task <code>chess-004</code> now drives the 3D board from live
          engine state, including turn tracking plus check, checkmate, and
          stalemate status messaging beside the scene.
        </p>

        <Link className="secondary-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  )
}
