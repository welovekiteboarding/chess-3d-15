import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          Chess 3D
        </Link>
        <nav aria-label="Primary navigation">
          <Link className="nav-link" to="/game">
            Game Shell
          </Link>
        </nav>
      </header>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}
