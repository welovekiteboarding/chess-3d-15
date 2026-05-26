import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessBoardStage />

      <div className="game-shell-page__footer">
        <p className="body-copy">
          Graph task <code>chess-004c</code> now surfaces live engine state in
          the game shell, including turn tracking plus check, checkmate, and
          stalemate status messaging beside the 3D board.
        </p>

        <Link className="secondary-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  )
}
