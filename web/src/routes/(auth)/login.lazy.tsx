import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/components/login-form'

export const Route = createLazyFileRoute('/(auth)/login')({
  component: LoginComponent,
})

function LoginComponent() {
  return (
    <div className="grid min-h-svh bg-[#FAFAFA] lg:grid-cols-[1fr_0.9fr]">
      <div className="flex flex-col px-6 py-7 md:px-12 md:py-10">
        <a href="/" className="flex w-fit items-center gap-2.5 text-[#0A0A0A]" aria-label="Kouponly home">
          <span className="grid size-9 place-items-center rounded-xl bg-[#18B852] text-lg font-black">K</span>
          <span className="font-heading text-xl tracking-tight">Kouponly</span>
          <span className="ml-1 rounded-full bg-[#F0F0F2] px-2.5 py-1 text-[10px] font-semibold text-[#59595F]">ADMIN</span>
        </a>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <p className="mb-3 text-sm font-semibold text-[#59595F]">Your deals, in one place</p>
            <LoginForm />
          </div>
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-[#0A0A0A] px-14 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-28 size-[30rem] rounded-full border-[5rem] border-[#18B852]" />
        <div className="absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-[#18B852]" />
        <span className="relative z-10 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70">Kouponly operations</span>
        <div className="relative z-10 max-w-lg pb-8">
          <h1 className="mb-5 text-5xl leading-[1.08] text-white">Good deals.<br /><span className="text-[#18B852]">Well managed.</span></h1>
          <p className="max-w-sm text-base leading-7 text-white/65">Keep an eye on partners, offers and redemptions across Kouponly.</p>
        </div>
        <span className="relative z-10 text-xs text-white/45">The Kouponly team workspace</span>
      </aside>
    </div>
  )
}
