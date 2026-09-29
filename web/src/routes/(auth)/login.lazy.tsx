import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/components/login-form'

export const Route = createLazyFileRoute('/(auth)/login')({
  component: LoginComponent,
})

function LoginComponent() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium text-brand-green">
            realX
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:block bg-brand-green" />
    </div>
  )
}
