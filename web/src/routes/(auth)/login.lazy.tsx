import { createLazyFileRoute } from '@tanstack/react-router'
import { LoginForm } from '@/components/login-form'
import kouponlyLogo from '../../../../mobile/assets/images/kouponly-logo.png'

export const Route = createLazyFileRoute('/(auth)/login')({
  component: LoginComponent,
})

function LoginComponent() {
  return (
    <main className="admin-auth-shell min-h-svh bg-[#E8FAF0] text-[#0A0F0C] lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
      <div className="relative isolate overflow-hidden bg-[#0A0F0C] px-6 pb-16 pt-8 text-white sm:px-12 lg:flex lg:flex-col lg:justify-between lg:p-14">
        <a href="/" className="relative z-10 inline-flex w-fit items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white" aria-label="Kouponly home">
          <img src={kouponlyLogo} alt="" className="size-10 rounded-xl object-contain" />
          <span className="text-2xl font-semibold tracking-tight">Kouponly</span>
        </a>
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 -z-10 size-56 rotate-[-20deg] rounded-[3rem] border border-[#18B952]/25 bg-[#18B952]/10 lg:hidden" />
        <div className="hidden lg:block">
          <div aria-hidden="true" className="relative mx-auto mb-16 aspect-[1.65] w-full max-w-[25rem]">
            <div className="absolute inset-0 rotate-[-13deg] rounded-[2rem] border border-[#18B952]/35 bg-[#0A0F0C]" />
            <div className="absolute inset-0 grid rotate-[8deg] grid-cols-[1fr_27%] overflow-hidden rounded-[2rem] bg-[#18B952] shadow-2xl">
              <div className="grid place-items-center text-[clamp(4rem,9vw,8rem)] font-black leading-none tracking-[-0.1em] text-[#0A0F0C]">K</div>
              <div className="border-l-2 border-dashed border-[#0A0F0C]/35 bg-[#E8FAF0]" />
              <div className="absolute -top-3 right-[calc(27%-0.75rem)] size-6 rounded-full bg-[#0A0F0C]" />
              <div className="absolute -bottom-3 right-[calc(27%-0.75rem)] size-6 rounded-full bg-[#0A0F0C]" />
            </div>
          </div>
          <p className="text-sm font-medium text-[#E8FAF0]">Kouponly Admin</p>
        </div>
      </div>
      <div className="relative -mt-8 px-4 pb-8 sm:px-8 lg:mt-0 lg:grid lg:place-items-center lg:p-12">
        <div className="mx-auto w-full max-w-md rounded-[1.75rem] border border-[#18B952]/25 bg-white p-6 shadow-[0_14px_42px_-24px_#0A0F0C55] sm:p-10">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
