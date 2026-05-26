import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { appRoutes, routerFuture } from './routes'

vi.mock('../components/board/ChessBoardStage', () => ({
  ChessBoardStage: () => <div>3D chess board foundation</div>,
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
    expect(
      screen.getByText((content, node) => {
        return (
          node?.tagName.toLowerCase() === 'code' && content.trim() === 'chess-004'
        )
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
