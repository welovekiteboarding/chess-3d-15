import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="hero-panel">
      <p className="eyebrow">Issue C31-2</p>
      <h1>Chess 3D</h1>
      <p className="body-copy hero-copy">
        A typed browser scaffold for a 3D chess experience with a dedicated home
        route, a game shell route, and the tooling needed for fast iteration.
      </p>

      <div className="action-row">
        <Link className="primary-button" to="/game">
          Open game shell
        </Link>
        <a
          className="secondary-link"
          href="https://react.dev/"
          rel="noreferrer"
          target="_blank"
        >
          React docs
        </a>
      </div>

      <div className="feature-grid">
        <article className="feature-card">
          <h2>3D-ready stack</h2>
          <p>
            React, TypeScript, Three.js, and React Three Fiber are installed.
          </p>
        </article>
        <article className="feature-card">
          <h2>Testable routes</h2>
          <p>
            Vitest and Testing Library cover the landing and game shell views.
          </p>
        </article>
        <article className="feature-card">
          <h2>Clean handoff</h2>
          <p>
            ESLint, Prettier, and Vite scripts keep the baseline ready to
            extend.
          </p>
        </article>
      </div>
    </section>
  )
}
