import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { appRoutes, routerFuture } from './routes'

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

    expect(
      screen.getByRole('heading', { name: /game shell/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/canvas mount point is ready/i)).toBeInTheDocument()
  })
})
