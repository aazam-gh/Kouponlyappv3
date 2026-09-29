import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/auth"
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router"
import * as React from "react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/login' })
  const { loginWithEmail } = useAuth()
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    try {
      const role = await loginWithEmail(email, password)
      await router.invalidate()
      const fallback = role.admin
        ? '/admin/dashboard'
        : role.holding
          ? '/holding/dashboard'
          : '/dashboard'
      await navigate({ to: search.redirect || fallback })
    } catch (err) {
      console.error("Login error:", err)
      setError(err instanceof Error ? err.message : "Failed to sign in. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleEmailLogin}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md text-center">
            {error}
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="m@example.com" required disabled={isLoading} autoComplete="username" />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input id="password" name="password" type="password" required disabled={isLoading} autoComplete="current-password" />
        </Field>
        <Field>
          <Button type="submit" disabled={isLoading} className="w-full bg-brand-green hover:bg-brand-green/90 text-white">
            {isLoading ? "Signing in..." : "Login"}
          </Button>
        </Field>

      </FieldGroup>
    </form>
  )
}
