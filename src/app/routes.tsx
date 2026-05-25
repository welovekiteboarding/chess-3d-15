import type { RouteObject } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { GameShellPage } from '../routes/GameShellPage'
import { HomePage } from '../routes/HomePage'

export const routerFuture = {
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_relativeSplatPath: true,
  v7_skipActionErrorRevalidation: true,
  v7_startTransition: true,
} as const

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'game',
        element: <GameShellPage />,
      },
    ],
  },
]
