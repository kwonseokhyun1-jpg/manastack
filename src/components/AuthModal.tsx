import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AuthMode = 'login' | 'signup'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export function AuthModal() {
  const { authModalOpen, closeAuthModal, logIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!authModalOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    if (mode === 'signup' && !USERNAME_PATTERN.test(username.trim())) {
      setError('Username must be 3–20 characters (letters, numbers, underscores only).')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email, username.trim(), password)
      } else {
        await logIn(email, password)
      }
      setUsername('')
      setEmail('')
      setPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-mtg-gold)]">
              {mode === 'login' ? 'Log in' : 'Sign up'}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
              Save mana, cards, and folders to your account.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="text-[var(--color-mtg-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError(null)
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-[var(--color-mtg-gold)] text-black'
                : 'border border-[var(--color-mtg-border)] text-[var(--color-mtg-muted)]'
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError(null)
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === 'signup'
                ? 'bg-[var(--color-mtg-gold)] text-black'
                : 'border border-[var(--color-mtg-border)] text-[var(--color-mtg-muted)]'
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          {mode === 'signup' && (
            <label className="block text-sm">
              <span className="text-[var(--color-mtg-muted)]">Username</span>
              <input
                type="text"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]{3,20}"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="text-[var(--color-mtg-muted)]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-mtg-muted)]">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
            />
          </label>
          {mode === 'signup' && (
            <label className="block text-sm">
              <span className="text-[var(--color-mtg-muted)]">Confirm password</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-white focus:border-[var(--color-mtg-gold)] focus:outline-none"
              />
            </label>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[var(--color-mtg-gold)] py-2.5 text-sm font-semibold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}
