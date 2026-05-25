import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessBoardStage />

      <div className="game-shell-page__footer">
        <p className="body-copy">
          Foundation pass for graph task <code>chess-003</code>: the browser now
          has a responsive 3D board, complete opening layout, and reusable
          square-to-scene mapping helpers.
        </p>

        <Link className="secondary-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  )
}
