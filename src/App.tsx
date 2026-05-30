import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { AuthModal } from './components/AuthModal'
import { Layout, type TabId } from './components/Layout'
import { MinigamesTab } from './tabs/MinigamesTab'
import { ShopTab } from './tabs/ShopTab'
import { InventoryTab } from './tabs/InventoryTab'
import { ProfileTab } from './tabs/ProfileTab'
import { TradeTab } from './tabs/TradeTab'

function AppShell() {
  const [tab, setTab] = useState<TabId>('minigames')

  return (
    <>
      <Layout active={tab} onTabChange={setTab}>
        {tab === 'minigames' && <MinigamesTab />}
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
      <Analytics />
    </AuthProvider>
  )
}

export default App
