import { Link } from 'react-router-dom'
import { ChessViewportPlaceholder } from '../components/game/ChessViewportPlaceholder'

export function GameShellPage() {
  return (
    <section className="game-shell-page">
      <ChessViewportPlaceholder />

      <div className="status-grid">
        <article className="status-card">
          <p className="eyebrow">Current route</p>
          <h3>/game</h3>
          <p>
            Reserved for the playable board, camera, and move interaction
            layers.
          </p>
        </article>
        <article className="status-card">
          <p className="eyebrow">Next graph tasks</p>
          <h3>Engine, scene, interaction</h3>
          <p>
            This scaffold separates the app shell from future chess rules and 3D
            rendering modules.
          </p>
        </article>
      </div>

      <Link className="secondary-link" to="/">
        Back to home
      </Link>
    </section>
  )
}
