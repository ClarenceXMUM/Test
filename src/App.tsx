import { useState } from 'react'
import { Sidebar, PanelId } from './components/layout/Sidebar'
import { PanelDrawer } from './components/layout/PanelDrawer'
import { OverviewContent } from './components/layout/OverviewContent'
import { AnalysisContent } from './components/layout/AnalysisContent'
import { ProfileContent } from './components/layout/ProfileContent'
import './App.css'

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelId | null>('analysis')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function handleNav(id: PanelId) {
    setActivePanel(prev => prev === id ? null : id)
  }

  return (
    <div className="app-layout">
      <Sidebar
        active={activePanel}
        onSelect={handleNav}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(v => !v)}
      />
      <PanelDrawer open={activePanel !== null}>
        {activePanel === 'overview' && <OverviewContent />}
        {activePanel === 'analysis' && <AnalysisContent />}
        {activePanel === 'profile' && <ProfileContent />}
      </PanelDrawer>
    </div>
  )
}
