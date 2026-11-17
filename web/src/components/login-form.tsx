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
import { ArrowRight } from "lucide-react"
import * as React from "react"
import kouponlyLogo from "../../../mobile/assets/images/kouponly-logo.png"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const router = useRouter()
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/login' })
  const { loginWithIdentifier } = useAuth()
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const identifier = formData.get("identifier") as string
    const password = formData.get("password") as string

    try {
      const role = await loginWithIdentifier(identifier, password)
      await router.invalidate()
      const fallback = role.admin ? '/admin/dashboard' : '/dashboard'
      await navigate({ to: search.redirect || fallback })
    } catch (err) {
      console.error("Login error:", err)
      setError(err instanceof Error ? err.message : "Failed to sign in. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} onSubmit={handleLogin}>
      <div className="space-y-2">
        <img src={kouponlyLogo} alt="Kouponly" className="mx-auto mb-6 h-12 w-auto object-contain" />
        <h1 className="text-center text-3xl font-bold tracking-tight text-[#0A0F0C] sm:text-4xl">Sign in</h1>
        <p className="text-center text-sm text-[#5F6861]">Use your Kouponly email or username.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <FieldGroup className="gap-5">
        <Field className="gap-2">
          <FieldLabel htmlFor="identifier">Email or username</FieldLabel>
          <Input id="identifier" name="identifier" type="text" required disabled={isLoading} autoComplete="username" autoCapitalize="none" spellCheck={false} className="h-12 rounded-xl bg-[#E8FAF0] px-3.5 text-base md:text-base" />
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" required disabled={isLoading} autoComplete="current-password" className="h-12 rounded-xl bg-[#E8FAF0] px-3.5 text-base md:text-base" />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isLoading} className="h-12 w-full justify-between rounded-xl bg-[#18B952] px-4 text-base font-semibold text-[#0A0F0C] hover:brightness-95">
        {isLoading ? "Signing in…" : "Sign in"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </form>
  )
}
