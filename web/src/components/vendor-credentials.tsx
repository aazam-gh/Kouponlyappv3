import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { vendorCredentials, type CredentialStatus } from '@/lib/vendor-credentials'

// Capture once outside React: StrictMode invokes state initializers twice.
const initialCredentialLink = typeof window !== 'undefined' && window.location.pathname === '/credentials'
  ? new URLSearchParams(window.location.hash.slice(1)) : new URLSearchParams()
if (typeof window !== 'undefined' && window.location.pathname === '/credentials') window.history.replaceState({}, '', '/credentials')

export function VendorCredentials({ vendorId }: { vendorId?: string }) {
  const admin = Boolean(vendorId)
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CredentialStatus | null>(null)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const target = vendorId ? { vendorId } : {}
  const load = async () => {
    const next = await vendorCredentials<CredentialStatus>('status', target)
    setStatus(next)
    setUsername(next.username)
  }
  useEffect(() => {
    let active = true
    setStatus(null)
    void vendorCredentials<CredentialStatus>('status', vendorId ? { vendorId } : {}).then(next => {
      if (active) { setStatus(next); setUsername(next.username) }
    }).catch(cause => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [vendorId])

  const run = async (action: string, data: Record<string, unknown> = {}) => {
    setBusy(true); setError(''); setMessage('')
    try {
      if (action === 'status') { await load(); return }
      const result = await vendorCredentials(action, { ...target, ...data })
      setMessage(result.message)
      setPassword(''); setConfirmation(''); setCurrentPassword('')
      await load()
      if (action === 'changeUsername') await queryClient.invalidateQueries()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update credentials.') }
    finally { setBusy(false) }
  }
  const input = 'h-11 w-full rounded-lg border bg-background px-3 font-normal'
  const button = 'rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50'
  return <section className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
    <div><h2 className="text-lg font-semibold">Account credentials</h2><p className="text-sm text-muted-foreground">Sign in using your username and password. Recovery email is separate from your business contact email.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {!status ? <button disabled={busy} onClick={() => void run('status')} className="text-sm underline">{error ? 'Retry loading account' : 'Loading account…'}</button> : <>
      <p className="text-sm">Username: <strong>{status.username || 'Legacy email login'}</strong></p>
      {admin && <form className="space-y-3 border-t pt-4" onSubmit={event => { event.preventDefault(); void run('changeUsername', { username }) }}>
        <label className="grid gap-1.5 text-sm font-medium">New username<input className={input} required maxLength={128} autoComplete="off" value={username} onChange={event => setUsername(event.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Usernames are case-sensitive. The previous username stops working after this change.</p>
        <button disabled={busy || username === status.username} className={button}>Change username</button>
      </form>}
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm">Verified recovery email: <strong>{status.email || 'Not set'}</strong></p>
        {status.pendingEmail && <p className="text-sm text-amber-800">Awaiting verification: {status.pendingEmail}</p>}
        <button type="button" disabled={busy} onClick={() => void run('status')} className="text-sm underline">Refresh verification status</button>
      </div>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run('enrollEmail', { email, currentPassword }) }}>
        <label className="grid gap-1.5 text-sm font-medium">{status.email ? 'New recovery email' : 'Recovery email'}<input className={input} type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
        {!admin && <label className="grid gap-1.5 text-sm font-medium">Current password<input className={input} type="password" required autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>}
        <button disabled={busy} className={button}>Send verification email</button>
      </form>
      <div className="space-y-2 border-t pt-4">
        <button type="button" className={button} disabled={busy || !status.email} onClick={() => void run('sendReset')}>Send password reset email</button>
        {!status.email && <p className="text-xs text-muted-foreground">Verify a recovery email to enable email password resets.</p>}
      </div>
      {admin && <form className="space-y-3 border-t pt-4" onSubmit={event => {
        event.preventDefault()
        if (password !== confirmation) { setError('The passwords do not match.'); return }
        void run('setPassword', { password })
      }}>
        <h3 className="font-medium">Set a new password directly</h3>
        <p className="text-xs text-muted-foreground">Use this for assisted recovery. The vendor will need the new password to sign in.</p>
        <label className="grid gap-1.5 text-sm font-medium">New password<input className={input} type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Confirm password<input className={input} type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <button disabled={busy} className={button}>Set vendor password</button>
      </form>}
    </>}
  </section>
}

export function VendorCredentialLink() {
  // Keep secrets in the fragment, then remove them before analytics or navigation can retain them.
  const [link] = useState(() => {
    return { kind: initialCredentialLink.get('kind'), token: initialCredentialLink.get('token') }
  })
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const valid = Boolean(link.token && /^[a-f0-9]{64}$/.test(link.token) && ['reset', 'verify'].includes(link.kind || ''))
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f7f5] p-4"><section className="w-full max-w-md space-y-4 rounded-xl border bg-white p-7 shadow-sm">
    <h1 className="text-2xl font-bold">{link.kind === 'verify' ? 'Verify recovery email' : 'Reset password'}</h1>
    {!valid ? <p role="alert">This link is invalid. Open the link from your email or request a new one.</p> : message ? <p role="status">{message}</p> : <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); setError('')
      if (link.kind === 'reset' && password !== confirmation) { setError('The passwords do not match.'); return }
      setBusy(true)
      try {
        const result = await vendorCredentials(link.kind === 'verify' ? 'verifyEmail' : 'completeReset', { token: link.token, password })
        setPassword(''); setConfirmation(''); setMessage(result.message)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'This link could not be used.') }
      finally { setBusy(false) }
    }}>
      {link.kind === 'reset' ? <>
        <label className="grid gap-2 text-sm">New password<input className="h-11 rounded-lg border px-3" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <label className="grid gap-2 text-sm">Confirm password<input className="h-11 rounded-lg border px-3" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      </> : <p>Confirm this inbox as your vendor account’s recovery email.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-green-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Submitting…' : link.kind === 'verify' ? 'Verify email' : 'Save new password'}</button>
    </form>}
    <a href="/login" className="block text-sm text-green-800 underline">Back to sign in</a>
  </section></main>
}
