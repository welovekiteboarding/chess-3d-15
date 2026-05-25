import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { appRoutes, routerFuture } from './routes'

const router = createBrowserRouter(appRoutes, {
  future: routerFuture,
})

export function App() {
  return <RouterProvider future={routerFuture} router={router} />
}
