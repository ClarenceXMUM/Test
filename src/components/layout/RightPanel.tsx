import { Card } from '../ui/Card'
import './Panel.css'

export function RightPanel() {
  return (
    <aside className="panel panel--right">
      <h2 className="panel__title">个人中心</h2>
      <Card title="目标设定">
        <p className="panel__placeholder">Coming soon</p>
      </Card>
      <Card title="数据导出">
        <p className="panel__placeholder">Coming soon</p>
      </Card>
    </aside>
  )
}
