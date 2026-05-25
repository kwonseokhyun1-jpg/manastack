import type { ReactNode } from 'react'
import { AuthButton } from './AuthButton'
import { ManaDisplay } from './ManaDisplay'

export type TabId = 'minigames' | 'shop' | 'inventory' | 'trade' | 'profile'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'minigames', label: 'Minigames', icon: '🎮' },
  { id: 'shop', label: 'Shop', icon: '🛒' },
  { id: 'inventory', label: 'Inventory', icon: '📚' },
  { id: 'trade', label: 'Trade', icon: '🔄' },
  { id: 'profile', label: 'Profile', icon: '👤' },
]

type LayoutProps = {
  active: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

export function Layout({ active, onTabChange, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[var(--color-mtg-border)] bg-[var(--color-mtg-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-mtg-gold)] sm:text-2xl">
              Manastack
            </h1>
            <p className="hidden text-xs text-[var(--color-mtg-muted)] sm:block">
              Play minigames · Earn mana · Collect cards
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AuthButton />
            <ManaDisplay />
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
                active === tab.id
                  ? 'bg-[var(--color-mtg-gold)] text-black'
                  : 'text-[var(--color-mtg-muted)] hover:bg-[var(--color-mtg-panel)] hover:text-white'
              }`}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
