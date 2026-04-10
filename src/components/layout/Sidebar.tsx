import './Sidebar.css'

export type PanelId = 'overview' | 'analysis' | 'profile'

const NAV_ITEMS: { id: PanelId; icon: string; label: string }[] = [
  { id: 'overview', icon: '🏃', label: '训练总览' },
  { id: 'analysis', icon: '📊', label: '深度分析' },
  { id: 'profile',  icon: '👤', label: '个人中心' },
]

interface SidebarProps {
  active: PanelId | null
  onSelect: (id: PanelId) => void
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ active, onSelect, collapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Brand — click to toggle */}
      <button
        className="sidebar__brand"
        onClick={onToggle}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {collapsed ? 'RA' : 'Running Analytics'}
      </button>

      {/* Nav items */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`sidebar__item ${active === item.id ? 'sidebar__item--active' : ''}`}
            onClick={() => onSelect(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar__icon">{item.icon}</span>
            {!collapsed && <span className="sidebar__label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />
    </aside>
  )
}
