import { useState, useEffect } from 'react'
import type { DailySummary, SalesByItem, HourlyTrend } from '../types'
import { BarChart2, Download, RefreshCw, TrendingUp, ShoppingBag, DollarSign, XCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts'

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

export default function ReportsView() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [topItems, setTopItems] = useState<SalesByItem[]>([])
  const [hourly, setHourly] = useState<HourlyTrend[]>([])
  const [loading, setLoading] = useState(false)

  const loadReports = async () => {
    setLoading(true)
    try {
      const [s, items, h] = await Promise.all([
        window.posAPI.reports.getDailySummary(selectedDate),
        window.posAPI.reports.getSalesByItem(selectedDate, selectedDate),
        window.posAPI.reports.getHourlyTrends(selectedDate),
      ])
      setSummary(s)
      setTopItems(items.slice(0, 8))
      setHourly(h)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadReports() }, [selectedDate])

  const handleExport = async () => {
    const result = await window.posAPI.reports.exportCsv('orders', selectedDate, selectedDate)
    if (result.success) {
      alert(`✅ Exported to: ${result.path}`)
    }
  }

  const currency = (v: number) => `₱${(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const PAYMENT_COLORS: Record<string, string> = {
    cash: '#10B981', card: '#6366F1', gcash: '#3B82F6',
    maya: '#8B5CF6', grabfood: '#00B14F', foodpanda: '#D70F64',
  }

  const PAYMENT_EMOJI: Record<string, string> = {
    cash: '💵', card: '💳', gcash: '📱', maya: '🟣', grabfood: '🟢', foodpanda: '🐼',
  }

  return (
    <div className="reports-layout">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart2 size={22} color="var(--color-primary)" />
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Reports</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="btn btn--ghost btn--sm" onClick={loadReports} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
          <button className="btn btn--secondary btn--sm" onClick={handleExport}>
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={16} color="var(--color-primary)" />
            <div className="stat-card__label">Total Orders</div>
          </div>
          <div className="stat-card__value">{summary?.orders.total_orders ?? 0}</div>
          {(summary?.voidedOrders.count ?? 0) > 0 && (
            <div className="stat-card__sub" style={{ color: 'var(--color-danger)' }}>
              {summary?.voidedOrders.count} voided
            </div>
          )}
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color="var(--color-success)" />
            <div className="stat-card__label">Gross Sales</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 22 }}>
            {currency(summary?.orders.gross_sales ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={16} color="var(--color-danger)" />
            <div className="stat-card__label">Discounts</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 22, color: 'var(--color-danger)' }}>
            -{currency(summary?.orders.total_discounts ?? 0)}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} color="var(--color-accent)" />
            <div className="stat-card__label">Net Sales</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 22, color: 'var(--color-accent)' }}>
            {currency(summary?.orders.net_sales ?? 0)}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Hourly Trends */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            Hourly Sales Trend
          </div>
          {hourly.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={h => `${h}:00`} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₱${v}`} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                  labelFormatter={h => `${h}:00`}
                  formatter={(v: number) => [`₱${v.toFixed(2)}`, 'Sales']}
                />
                <Line type="monotone" dataKey="sales" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: 'var(--color-primary)', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No data for this date
            </div>
          )}
        </div>

        {/* Payment Methods Breakdown */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
            Payment Methods
          </div>
          {(summary?.byPaymentMethod.length ?? 0) > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summary?.byPaymentMethod.map(pm => {
                const pct = summary.orders.gross_sales ? (pm.amount / summary.orders.gross_sales) * 100 : 0
                return (
                  <div key={pm.method}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span>{PAYMENT_EMOJI[pm.method] || '💰'} {pm.method.toUpperCase()}</span>
                      <span style={{ fontWeight: 700 }}>{currency(pm.amount)}</span>
                    </div>
                    <div style={{ background: 'var(--color-surface-3)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: PAYMENT_COLORS[pm.method] || 'var(--color-primary)',
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-muted)' }}>
              No payments today
            </div>
          )}
        </div>
      </div>

      {/* Top Items */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          Best Selling Items
        </div>
        {topItems.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topItems} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={v => `₱${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={120} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-3)', border: '1px solid var(--color-border)', borderRadius: 8 }}
                formatter={(v: number) => [`₱${v.toFixed(2)}`, 'Sales']}
              />
              <Bar dataKey="total_sales" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No sales data for this date
          </div>
        )}
      </div>

      {/* Order Type Breakdown */}
      {(summary?.byType.length ?? 0) > 0 && (
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Orders by Type</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {summary?.byType.map(t => (
              <div key={t.type} style={{
                flex: '1 1 120px',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                borderLeft: `3px solid var(--color-primary)`,
              }}>
                <div className={`order-type-badge order-type-badge--${t.type}`} style={{ marginBottom: 8 }}>
                  {t.type.replace('_', ' ')}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{t.count}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{currency(t.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
