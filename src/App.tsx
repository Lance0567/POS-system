import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useSessionStore } from './stores/session.store'
import LoginScreen from './views/LoginScreen'
import AppShell from './components/AppShell'
import POSView from './views/POSView'
import TablesView from './views/TablesView'
import KDSView from './views/KDSView'
import ReportsView from './views/ReportsView'
import MenuView from './views/MenuView'
import SettingsView from './views/SettingsView'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useSessionStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const { setSyncStatus } = useSessionStore()

  useEffect(() => {
    // Listen for sync status changes from Electron
    const unsub = window.posAPI?.sync?.onStatusChange(setSyncStatus)
    // Get initial sync status
    window.posAPI?.sync?.getStatus().then(setSyncStatus)
    return () => unsub?.()
  }, [setSyncStatus])

  return (
    <HashRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1C2640',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            fontSize: '14px',
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/kds" element={<KDSView standalone />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/tables" replace />} />
                  <Route path="/pos" element={<POSView />} />
                  <Route path="/pos/:tableId" element={<POSView />} />
                  <Route path="/tables" element={<TablesView />} />
                  <Route path="/kitchen" element={<KDSView />} />
                  <Route path="/reports" element={<ReportsView />} />
                  <Route path="/menu" element={<MenuView />} />
                  <Route path="/settings" element={<SettingsView />} />
                </Routes>
              </AppShell>
            </RequireAuth>
          }
        />
      </Routes>
    </HashRouter>
  )
}
