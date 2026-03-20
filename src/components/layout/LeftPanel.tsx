import { Card } from '../ui/Card'
import './Panel.css'

export function LeftPanel() {
  return (
    <aside className="panel panel--left">
      <h2 className="panel__title">训练总览</h2>
      <Card title="跑量概览">
        <p className="panel__placeholder">导入训练数据后显示</p>
      </Card>
      <Card title="负荷趋势">
        <p className="panel__placeholder">导入训练数据后显示</p>
      </Card>
    </aside>
  )
}
