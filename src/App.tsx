import { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { AuthModal } from './components/AuthModal'
import { Layout, type TabId } from './components/Layout'
import { DecksTab } from './tabs/DecksTab'
import { MinigamesTab } from './tabs/MinigamesTab'
import { PlaytestTab } from './tabs/PlaytestTab'
import { ShopTab } from './tabs/ShopTab'
import { InventoryTab } from './tabs/InventoryTab'
import { ProfileTab } from './tabs/ProfileTab'
import { TradeTab } from './tabs/TradeTab'

function AppShell() {
  const [tab, setTab] = useState<TabId>('minigames')
  const [playtestDeckId, setPlaytestDeckId] = useState<string | null>(null)

  return (
    <>
      <Layout active={tab} onTabChange={setTab}>
        {tab === 'minigames' && <MinigamesTab />}
        {tab === 'decks' && (
          <DecksTab
            onPlaytest={(deckId) => {
              setPlaytestDeckId(deckId)
              setTab('playtest')
            }}
          />
        )}
        {tab === 'playtest' && (
          <PlaytestTab
            initialSavedDeckId={playtestDeckId}
            onConsumedInitialDeck={() => setPlaytestDeckId(null)}
          />
        )}
        {tab === 'shop' && <ShopTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'trade' && <TradeTab />}
        {tab === 'profile' && <ProfileTab />}
      </Layout>
      <AuthModal />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <AppShell />
      </GameProvider>
    </AuthProvider>
  )
}

export default App
