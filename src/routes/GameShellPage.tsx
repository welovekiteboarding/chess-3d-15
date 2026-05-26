import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessBoardStage />

      <div className="game-shell-page__footer">
        <p className="body-copy">
          Graph task <code>chess-005d</code> now routes the shared mouse and
          touch move handling through <code>src/input</code> into the live 3D
          board.
        </p>

        <Link className="secondary-link" to="/">
          Back to home
        </Link>
      </div>
    </section>
  )
}
