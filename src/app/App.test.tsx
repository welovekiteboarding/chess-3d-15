import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { appRoutes, routerFuture } from './routes'

vi.mock('../components/board/ChessBoardStage', () => ({
  ChessBoardStage: ({ controls }: { controls?: ReactNode }) => (
    <div>
      <div>3D chess board foundation</div>
      {controls}
    </div>
  ),
}))

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, {
    future: routerFuture,
    initialEntries: [path],
  })

  return render(<RouterProvider future={routerFuture} router={router} />)
}

describe('app routes', () => {
  it('renders the landing page with a game shell call to action', () => {
    renderRoute('/')

    expect(
      screen.getByRole('heading', { name: /chess 3d/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open game shell/i }),
    ).toHaveAttribute('href', '/game')
  })

  it('renders the game shell scaffold route', () => {
    renderRoute('/game')

    expect(screen.getByText(/3d chess board foundation/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('renders the hint controls on the game shell route', () => {
    renderRoute('/game')

    expect(screen.getByText('Issue C31-33')).toBeInTheDocument()
    expect(screen.getByText('Graph task chess-008d')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show hint' })).toBeInTheDocument()
  })
})
