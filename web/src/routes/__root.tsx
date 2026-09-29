import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import type { AuthContextType } from '../auth'

export type MyRouterContext = {
  auth: AuthContextType
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
      <TanStackRouterDevtools position="bottom-right" initialIsOpen={false} />
    </>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-muted-foreground max-w-md">{error.message || 'An unexpected error occurred.'}</p>
      </div>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="outline">Try Again</Button>
        <Button onClick={() => window.location.href = '/'} className="bg-brand-green hover:bg-brand-green/90 text-white">
          Go Home
        </Button>
      </div>
    </div>
  ),
})
