import './PanelDrawer.css'

interface PanelDrawerProps {
  open: boolean
  children: React.ReactNode
}

export function PanelDrawer({ open, children }: PanelDrawerProps) {
  return (
    <div className={`panel-drawer ${open ? 'panel-drawer--open' : ''}`}>
      <div className="panel-drawer__inner">
        {children}
      </div>
    </div>
  )
}
