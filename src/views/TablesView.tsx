import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Table } from '../types'
import { Plus, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  available: 'var(--color-success)',
  occupied: 'var(--color-danger)',
  reserved: 'var(--color-warning)',
}

export default function TablesView() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadTables = async () => {
    try {
      const data = await window.posAPI.tables.getAll()
      setTables(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables()
    const interval = setInterval(loadTables, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

  const handleTableClick = (table: Table) => {
    if (table.status === 'available') {
      navigate(`/pos/${table.id}`)
    } else if (table.status === 'occupied' && table.current_order_id) {
      navigate(`/pos/${table.id}`)
    }
  }

  const sections = [...new Set(tables.map(t => t.section))]

  const available = tables.filter(t => t.status === 'available').length
  const occupied = tables.filter(t => t.status === 'occupied').length

  return (
    <div className="table-map">
      {/* Header Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            Table Map
          </h1>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
              ● {available} Available
            </span>
            <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
              ● {occupied} Occupied
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={loadTables}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn--primary btn--sm" onClick={() => navigate('/pos')}>
            <Plus size={14} />
            New Order
          </button>
        </div>
      </div>

      {/* Table Sections */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
          Loading tables...
        </div>
      ) : (
        sections.map(section => (
          <div key={section}>
            <div className="table-section-title">{section} Area</div>
            <div className="tables-grid">
              {tables.filter(t => t.section === section).map(table => (
                <div
                  key={table.id}
                  className={`table-card table-card--${table.status}`}
                  onClick={() => handleTableClick(table)}
                >
                  <div
                    className="table-status-dot"
                    style={{ background: STATUS_COLORS[table.status] }}
                  />
                  <div style={{ fontSize: 28 }}>
                    {table.status === 'occupied' ? '🍽️' : '⬜'}
                  </div>
                  <div className="table-card__name">{table.name}</div>
                  <div className="table-card__capacity" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={11} />
                    {table.capacity} seats
                  </div>
                  {table.status === 'occupied' && (
                    <>
                      <div className="table-card__order">{table.order_number}</div>
                      {table.order_total ? (
                        <div className="table-card__amount">
                          ₱{table.order_total.toFixed(2)}
                        </div>
                      ) : null}
                    </>
                  )}
                  {table.status === 'available' && (
                    <div style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>
                      Tap to seat
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
