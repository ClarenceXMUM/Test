import { LeftPanel } from './components/layout/LeftPanel'
import { CenterPanel } from './components/layout/CenterPanel'
import { RightPanel } from './components/layout/RightPanel'
import './App.css'

export default function App() {
  return (
    <div className="app-layout">
      <LeftPanel />
      <CenterPanel />
      <RightPanel />
    </div>
  )
}
