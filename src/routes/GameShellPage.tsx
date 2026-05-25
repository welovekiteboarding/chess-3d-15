import { Link } from 'react-router-dom'
import { ChessBoardStage } from '../components/board/ChessBoardStage'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessBoardStage />

      <div className="status-grid">
        <article className="status-card">
          <p className="eyebrow">Board mapping</p>
          <h3>Scene coordinates ready</h3>
          <p>
            Square helpers convert chess notation into stable 3D positions for
            future move animation, hit testing, and legal-move overlays.
          </p>
        </article>
        <article className="status-card">
          <p className="eyebrow">Scene quality</p>
          <h3>Lit, shadowed, responsive</h3>
          <p>
            The foundation now includes a pleasing default camera angle, orbit
            controls, responsive sizing, and shadow-casting materials.
          </p>
        </article>
      </div>

      <Link className="secondary-link" to="/">
        Back to home
      </Link>
    </section>
  )
}
