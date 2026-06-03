import { NavLink, useLocation } from 'react-router-dom'
import { useSessionStore } from '../stores/session.store'
import type { SyncStatus, UserRole } from '../types'
import {
  ShoppingCart, LayoutGrid, ChefHat, BarChart2,
  UtensilsCrossed, Settings, Minus, Maximize2, X, MonitorPlay
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/tables', icon: LayoutGrid, label: 'Tables', roles: ['owner','manager','cashier','waiter'] },
  { to: '/pos', icon: ShoppingCart, label: 'POS', roles: ['owner','manager','cashier','waiter'] },
  { to: '/kitchen', icon: ChefHat, label: 'Kitchen', roles: ['owner','manager','kitchen'] },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu', roles: ['owner','manager'] },
  { to: '/reports', icon: BarChart2, label: 'Reports', roles: ['owner','manager'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['owner'] },
]

const ROLE_COLORS: Record<UserRole, string> = {
  owner: '#F43F5E',
  manager: '#F59E0B',
  cashier: '#10B981',
  waiter: '#0EA5E9',
  kitchen: '#A78BFA',
}

const SYNC_LABELS: Record<SyncStatus, string> = {
  synced: 'Synced',
  pending: 'Pending',
  offline: 'Offline',
  syncing: 'Syncing...',
}

function SyncIndicator() {
  const syncStatus = useSessionStore(s => s.syncStatus)
  return (
    <div className={`sync-indicator sync-indicator--${syncStatus}`}>
      <div className={`sync-dot ${syncStatus === 'syncing' ? 'sync-dot--pulse' : ''}`} />
      {SYNC_LABELS[syncStatus]}
    </div>
  )
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useSessionStore()
  const location = useLocation()

  const handleMinimize = () => window.posAPI?.window.minimize()
  const handleMaximize = () => window.posAPI?.window.maximize()
  const handleClose = () => window.posAPI?.window.close()
  const handleOpenKds = () => window.posAPI?.window.openKds()

  const userRole = user?.role as UserRole
  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(userRole))

  return (
    <div className="app-shell">
      {/* Title Bar */}
      <div className="title-bar">
        <div className="title-bar__left">
          <span className="title-bar__logo">POS</span>
          <span className="title-bar__restaurant">My Restaurant</span>
        </div>

        <div className="title-bar__center">
          <SyncIndicator />
        </div>

        <div className="title-bar__right">
          {user && (
            <div className="staff-badge">
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: `linear-gradient(135deg, ${ROLE_COLORS[userRole] || '#6366F1'}, #A78BFA)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
              }}>
                {user.name[0]}
              </div>
              <span>{user.name}</span>
              <span className="staff-badge__role">{user.role}</span>
            </div>
          )}
          <button
            className="btn btn--ghost btn--sm"
            onClick={handleOpenKds}
            title="Open Kitchen Display"
          >
            <MonitorPlay size={14} />
          </button>
          <button className="btn btn--ghost btn--sm" onClick={logout} title="Logout">
            Logout
          </button>
          <div className="win-controls">
            <button className="win-btn" onClick={handleMinimize} title="Minimize"><Minus size={14} /></button>
            <button className="win-btn" onClick={handleMaximize} title="Maximize"><Maximize2 size={12} /></button>
            <button className="win-btn win-btn--close" onClick={handleClose} title="Close"><X size={14} /></button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="app-body">
        {/* Sidebar */}
        <nav className="sidebar">
          <div className="sidebar__nav">
            {visibleNav.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `nav-item ${isActive || (to === '/pos' && location.pathname.startsWith('/pos')) ? 'active' : ''}`
                }
                title={label}
              >
                <Icon size={20} />
                <span className="nav-item__tooltip">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  )
}
