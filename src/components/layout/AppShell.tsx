import { Link, Outlet } from 'react-router-dom'
import './visualIdentity.css'

export function AppShell() {
  return (
    <div className="app-shell">
      <div aria-hidden="true" className="app-shell__aurora" />
      <div aria-hidden="true" className="app-shell__atlas" />
      <header className="topbar">
        <Link className="brand" to="/">
          <img
            alt="Chess 3D crest"
            className="brand__mark"
            height="56"
            src="/chess-mark.svg"
            width="56"
          />
          <span className="brand__copy">
            <span className="brand__name">Chess 3D</span>
            <span className="brand__tagline">Volumetric match room</span>
          </span>
        </Link>
        <div className="topbar__actions">
          <p className="topbar__edition">Edition 01 · Brass observatory</p>
          <nav aria-label="Primary navigation" className="topbar__nav">
            <Link className="nav-link" to="/game">
              Game Shell
            </Link>
          </nav>
        </div>
      </header>

      <main className="page-shell">
        <div className="app-shell__frame">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
