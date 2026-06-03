import { useState } from 'react'
import { Settings, Info } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SettingsView() {
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [restaurantName, setRestaurantName] = useState('My Restaurant')
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [taxRate, setTaxRate] = useState('12')
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us!')

  const handleSave = async () => {
    toast.success('Settings saved!')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Settings size={22} color="var(--color-primary)" />
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Settings</h1>
      </div>

      {/* Restaurant Info */}
      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Restaurant Information</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Restaurant Name</label>
            <input className="input" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt Footer Message</label>
            <input className="input" value={receiptFooter} onChange={e => setReceiptFooter(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tax Settings */}
      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Tax Settings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Enable VAT</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add VAT to all orders automatically</div>
            </div>
            <button
              onClick={() => setTaxEnabled(!taxEnabled)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: taxEnabled ? 'var(--color-success)' : 'var(--color-surface-3)',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: taxEnabled ? 25 : 3, width: 20, height: 20,
                borderRadius: '50%', background: 'white', transition: 'left 0.2s',
              }} />
            </button>
          </div>
          {taxEnabled && (
            <div className="form-group">
              <label className="form-label">VAT Rate (%)</label>
              <input className="input" type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} style={{ maxWidth: 120 }} />
            </div>
          )}
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Cloud Sync (Supabase)</div>
          <span className="badge badge--info">Optional</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Connect to Supabase to sync data to the cloud and enable the owner dashboard.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Supabase Project URL</label>
            <input className="input" placeholder="https://xxxx.supabase.co" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Supabase Anon Key</label>
            <input className="input" type="password" placeholder="eyJhbGci..." value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--color-info-light)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--color-info)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Get these values from your Supabase project settings → API. The app works fully offline without this configured.</span>
          </div>
        </div>
      </div>

      <button className="btn btn--primary" onClick={handleSave} style={{ alignSelf: 'flex-start' }}>
        Save Settings
      </button>
    </div>
  )
}
