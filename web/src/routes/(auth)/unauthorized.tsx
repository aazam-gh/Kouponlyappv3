import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/unauthorized')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex min-h-[100vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-destructive">401 - Unauthorized</h1>
      <p className="text-muted-foreground">You do not have permission to view this page.</p>
      <Link to="/" className="mt-4">
        <Button variant="outline">Go Home</Button>
      </Link>
    </div>
  )
}
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
