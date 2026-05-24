import { useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { GameProvider } from './context/GameContext'
import { AuthModal } from './components/AuthModal'
import { Layout, type TabId } from './components/Layout'
import { MinigamesTab } from './tabs/MinigamesTab'
import { ShopTab } from './tabs/ShopTab'
import { InventoryTab } from './tabs/InventoryTab'
import { ProfileTab } from './tabs/ProfileTab'

function AppShell() {
  const [tab, setTab] = useState<TabId>('minigames')

  return (
    <>
      <Layout active={tab} onTabChange={setTab}>
        {tab === 'minigames' && <MinigamesTab />}
        {tab === 'shop' && <ShopTab />}
        {tab === 'inventory' && <InventoryTab />}
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
