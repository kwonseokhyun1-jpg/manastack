import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGame } from '../context/GameContext'
import { computeSetProgress, loadSetCatalog, type SetProgress } from '../lib/set-progress'
import { DAILY_LOGIN_MANA } from '../types/game'

function SetProgressBar({ set }: { set: SetProgress }) {
  const complete = set.percent >= 100

  return (
    <div className="rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{set.name}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-mtg-muted)]">
            {set.code}
          </p>
        </div>
        <p
          className={`shrink-0 text-sm font-semibold ${
            complete ? 'text-green-400' : 'text-[var(--color-mana-u)]'
          }`}
        >
          {set.percent}%
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-mtg-border)]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            complete ? 'bg-green-500' : 'bg-[var(--color-mana-u)]'
          }`}
          style={{ width: `${Math.min(set.percent, 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-mtg-muted)]">
        {set.owned.toLocaleString()} / {set.total.toLocaleString()} unique cards
      </p>
    </div>
  )
}

export function ProfileTab() {
  const { user, openAuthModal } = useAuth()
  const { collection, dailyLoginAvailable, claimDailyLogin, syncStatus } = useGame()
  const [setProgress, setSetProgress] = useState<SetProgress[]>([])
  const [setsLoading, setSetsLoading] = useState(true)
  const [setsError, setSetsError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [showAllSets, setShowAllSets] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSetCatalog()
      .then((catalog) => {
        if (cancelled) return
        setSetProgress(computeSetProgress(catalog, collection))
        setSetsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setSetsError(
          err instanceof Error ? err.message : 'Could not load set catalog. Run npm run build:sets.',
        )
        setSetsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [collection])

  const filteredSets = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    let list = setProgress
    if (needle) {
      list = list.filter(
        (s) => s.name.toLowerCase().includes(needle) || s.code.toLowerCase().includes(needle),
      )
    }
    if (!showAllSets) {
      list = list.filter((s) => s.owned > 0)
    }
    return list
  }, [setProgress, filter, showAllSets])

  const completedSets = useMemo(
    () => setProgress.filter((s) => s.percent >= 100).length,
    [setProgress],
  )

  const startedSets = useMemo(() => setProgress.filter((s) => s.owned > 0).length, [setProgress])

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-mtg-gold)]">
          Profile
        </h2>
        <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
          Account, daily rewards, and set collection progress.
        </p>
      </div>

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
          Account
        </h3>
        {user ? (
          <div className="mt-3 space-y-1 text-sm">
            <p className="text-white">
              <span className="text-[var(--color-mtg-muted)]">Username:</span>{' '}
              <span className="font-medium">{user.username ?? '—'}</span>
            </p>
            <p className="text-[var(--color-mtg-muted)]">{user.email}</p>
            {syncStatus === 'syncing' && (
              <p className="text-xs text-[var(--color-mtg-muted)]">Syncing progress…</p>
            )}
            {syncStatus === 'saved' && (
              <p className="text-xs text-green-400/80">Progress saved to cloud</p>
            )}
            {syncStatus === 'error' && (
              <p className="text-xs text-red-400">Cloud sync failed — progress saved locally</p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-[var(--color-mtg-muted)]">
              Log in to save progress and pick a unique username.
            </p>
            <button
              type="button"
              onClick={openAuthModal}
              className="mt-3 rounded-lg bg-[var(--color-mtg-gold)] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
            >
              Log in / Sign up
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
          Daily login
        </h3>
        {dailyLoginAvailable ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--color-mtg-muted)]">
              Claim your daily bonus once per day.
            </p>
            <button
              type="button"
              onClick={claimDailyLogin}
              className="mt-3 rounded-lg border border-[var(--color-mana-u)]/50 bg-[var(--color-mana-u)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-mana-u)] transition hover:bg-[var(--color-mana-u)]/20"
            >
              Claim +{DAILY_LOGIN_MANA} mana
            </button>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-mtg-muted)]">
            Daily login claimed — come back tomorrow for +{DAILY_LOGIN_MANA} mana.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-mtg-border)] bg-[var(--color-mtg-panel)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-mtg-gold)]">
              Set completion
            </h3>
            <p className="mt-1 text-sm text-[var(--color-mtg-muted)]">
              Unique card names owned per set · {completedSets} complete · {startedSets} in progress
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--color-mtg-muted)]">
            <input
              type="checkbox"
              checked={showAllSets}
              onChange={(e) => setShowAllSets(e.target.checked)}
              className="rounded border-[var(--color-mtg-border)]"
            />
            Show all sets
          </label>
        </div>

        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search sets…"
          className="mt-4 w-full rounded-lg border border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)] px-3 py-2 text-sm text-white placeholder:text-[var(--color-mtg-muted)] focus:border-[var(--color-mtg-gold)] focus:outline-none"
        />

        {setsLoading && (
          <p className="mt-4 text-center text-sm text-[var(--color-mtg-muted)]">Loading sets…</p>
        )}
        {setsError && <p className="mt-4 text-center text-sm text-red-400">{setsError}</p>}

        {!setsLoading && !setsError && (
          <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
            {filteredSets.length === 0 ? (
              <p className="text-center text-sm text-[var(--color-mtg-muted)]">
                {showAllSets
                  ? 'No sets match your search.'
                  : 'No set progress yet — open packs to start collecting.'}
              </p>
            ) : (
              filteredSets.map((set) => <SetProgressBar key={set.code} set={set} />)
            )}
          </div>
        )}
      </section>
    </div>
  )
}
