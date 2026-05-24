import { useAuth } from '../context/AuthContext'
import { useGame } from '../context/GameContext'

export function AuthButton() {
  const { user, openAuthModal, logOut } = useAuth()
  const { syncStatus } = useGame()

  if (!user) {
    return (
      <button
        type="button"
        onClick={openAuthModal}
        className="rounded-lg border border-[var(--color-mtg-gold-dim)] px-3 py-1.5 text-xs font-medium text-[var(--color-mtg-gold)] transition hover:bg-[var(--color-mtg-gold)]/10 sm:text-sm"
      >
        Log in / Sign up
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {syncStatus === 'syncing' && (
        <span className="hidden text-[10px] text-[var(--color-mtg-muted)] sm:inline">Syncing…</span>
      )}
      {syncStatus === 'saved' && (
        <span className="hidden text-[10px] text-green-400/80 sm:inline">Saved</span>
      )}
      {syncStatus === 'error' && (
        <span className="hidden text-[10px] text-red-400 sm:inline">Sync failed</span>
      )}
      <span className="max-w-[8rem] truncate text-xs text-[var(--color-mtg-muted)] sm:max-w-[10rem] sm:text-sm">
        {user.username ?? user.email}
      </span>
      <button
        type="button"
        onClick={logOut}
        className="rounded-lg border border-[var(--color-mtg-border)] px-2 py-1 text-xs text-[var(--color-mtg-muted)] transition hover:text-white sm:px-3 sm:py-1.5 sm:text-sm"
      >
        Log out
      </button>
    </div>
  )
}
