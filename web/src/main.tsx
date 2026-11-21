import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createLazyRoute, createRouter } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import { AuthContextProvider, useAuth } from './auth'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { capturePageView } from './analytics'

import './styles.css'

const queryClient = new QueryClient()

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: {
    auth: undefined!, // This will be set after we wrap the app in AuthContextProvider
    queryClient: queryClient,
  },
})
for (const route of Object.values(router.routesById)) {
  const load = route.lazyFn
  if (load) {
    // Render lazy module failures through the route boundary instead of rejecting route setup.
    route.lazy(() => load().catch((error: unknown) => createLazyRoute(route.id)({
      component: () => { throw error },
    })))
  }
}
router.subscribe('onResolved', () => capturePageView(router.state.matches.at(-1)?.routeId ?? '/'))

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function InnerApp() {
  const auth = useAuth()
  const hasResolvedAuth = React.useRef(false)
  React.useEffect(() => {
    if (auth.isInitialLoading) return
    if (hasResolvedAuth.current) void router.invalidate()
    hasResolvedAuth.current = true
  }, [auth.isInitialLoading, auth.user?.id, auth.isAdmin])
  if (auth.isInitialLoading) {
    return <p role="status" className="grid min-h-screen place-items-center text-sm text-muted-foreground">Restoring your session…</p>
  }
  return <RouterProvider router={router} context={{ auth, queryClient }} />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>
        <InnerApp />
      </AuthContextProvider>
    </QueryClientProvider>
  )
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main role="alert" className="mx-auto grid min-h-screen max-w-xl content-center gap-3 p-6">
          <h1 className="text-xl font-semibold">The admin panel could not load.</h1>
          {import.meta.env.DEV && <pre className="overflow-auto whitespace-pre-wrap rounded border bg-muted p-3 text-sm">{this.state.error.stack || this.state.error.message}</pre>}
          <button className="w-fit rounded-md border px-4 py-2" onClick={() => window.location.reload()}>Reload admin</button>
        </main>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </React.StrictMode>,
  )
}
