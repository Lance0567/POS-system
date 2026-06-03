import { useState, useEffect, useCallback } from 'react'
import type { Order, OrderItem, OrderType } from '../types'
import { Clock, CheckCircle, ChefHat, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

interface KDSViewProps {
  standalone?: boolean
}

function useKdsClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

function getElapsedMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
}

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [mins, setMins] = useState(getElapsedMinutes(createdAt))
  useEffect(() => {
    const t = setInterval(() => setMins(getElapsedMinutes(createdAt)), 30000)
    return () => clearInterval(t)
  }, [createdAt])
  const cls = mins >= 20 ? 'kds-card__timer--urgent' : mins >= 10 ? 'kds-card__timer--warning' : ''
  return <span className={`kds-card__timer ${cls}`}>{mins}m ago</span>
}

const ORDER_TYPE_EMOJI: Record<OrderType, string> = {
  dine_in: '🍽️', takeout: '🛍️', delivery: '🛵', grabfood: '🟢', foodpanda: '🐼',
}

interface ActiveOrder extends Order {
  items: OrderItem[]
}

export default function KDSView({ standalone }: KDSViewProps) {
  const [orders, setOrders] = useState<ActiveOrder[]>([])
  const time = useKdsClock()

  const loadOrders = useCallback(async () => {
    const active = await window.posAPI.orders.getActive()
    const withItems = await Promise.all(
      active
        .filter(o => ['pending', 'preparing', 'ready'].includes(o.status))
        .map(async o => {
          const detail = await window.posAPI.orders.getById(o.id)
          return { ...o, items: detail?.items ?? [] }
        })
    )
    setOrders(withItems as ActiveOrder[])
  }, [])

  useEffect(() => {
    loadOrders()
    const interval = setInterval(loadOrders, 15000)
    return () => clearInterval(interval)
  }, [loadOrders])

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    await window.posAPI.orders.update(orderId, { status: newStatus })
    loadOrders()
    const msgs: Record<string, string> = {
      preparing: '👨‍🍳 Order is being prepared',
      ready: '✅ Order is ready!',
      served: '🍽️ Order served',
    }
    toast.success(msgs[newStatus] || 'Status updated')
  }

  const handleItemDone = async (orderItemId: number) => {
    await window.posAPI.orders.updateItemStatus(orderItemId, 'done')
    loadOrders()
  }

  const urgentOrders = orders.filter(o => getElapsedMinutes(o.created_at) >= 20)

  return (
    <div style={{
      height: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* KDS Header */}
      <div style={{
        padding: '12px 24px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChefHat size={24} color="var(--color-primary)" />
          <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            Kitchen Display
          </span>
          <span style={{
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            padding: '2px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 13,
            fontWeight: 700,
          }}>
            {orders.length} Active
          </span>
          {urgentOrders.length > 0 && (
            <span style={{
              background: 'var(--color-danger-light)',
              color: 'var(--color-danger)',
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 13,
              fontWeight: 700,
              animation: 'urgentPulse 1.5s infinite',
            }}>
              ⚠️ {urgentOrders.length} Urgent
            </span>
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="kds-orders" style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        {orders.length === 0 && (
          <div style={{
            gridColumn: '1/-1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            gap: 12,
            padding: 80,
          }}>
            <ChefHat size={48} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>No active orders</div>
            <div style={{ fontSize: 13 }}>Orders will appear here when placed</div>
          </div>
        )}

        {orders.map(order => {
          const elapsed = getElapsedMinutes(order.created_at)
          const urgency = elapsed >= 20 ? 'urgent' : elapsed >= 10 ? 'warning' : 'normal'

          return (
            <div
              key={order.id}
              className={`kds-card kds-card--${urgency}`}
              style={{ animation: 'slideUp 0.3s ease' }}
            >
              {/* Card Header */}
              <div className="kds-card__header">
                <div>
                  <div className="kds-card__order-no">#{order.order_number}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {order.table_name || order.customer_name || 'Walk-in'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span className={`order-type-badge order-type-badge--${order.type}`}>
                    {ORDER_TYPE_EMOJI[order.type]} {order.type.replace('_', ' ')}
                  </span>
                  <ElapsedTimer createdAt={order.created_at} />
                </div>
              </div>

              {/* Order Status */}
              <div style={{ padding: '6px 16px', display: 'flex', gap: 6 }}>
                {['pending', 'preparing', 'ready'].map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(order.id, s)}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-full)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-family)',
                      background: order.status === s ? 'var(--color-primary)' : 'var(--color-surface-3)',
                      color: order.status === s ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Items */}
              <div className="kds-card__items">
                {order.items.map(item => (
                  <div
                    key={item.id}
                    className={`kds-item ${item.status === 'done' ? 'kds-item--done' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => item.status !== 'done' && handleItemDone(item.id)}
                  >
                    <span className="kds-item__qty">×{item.quantity}</span>
                    <div style={{ flex: 1 }}>
                      <div className="kds-item__name">{item.name}</div>
                      {item.notes && (
                        <div className="kds-item__addons">📝 {item.notes}</div>
                      )}
                      {item.addons && item.addons.length > 0 && (
                        <div className="kds-item__addons">
                          + {item.addons.map(a => a.name).join(', ')}
                        </div>
                      )}
                    </div>
                    {item.status === 'done' ? (
                      <CheckCircle size={16} color="var(--color-success)" />
                    ) : (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--color-border)' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="kds-card__actions">
                {order.status === 'pending' && (
                  <button
                    className="btn btn--primary btn--full"
                    onClick={() => handleStatusChange(order.id, 'preparing')}
                  >
                    <ChefHat size={14} />
                    Start Preparing
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    className="btn btn--success btn--full"
                    onClick={() => handleStatusChange(order.id, 'ready')}
                  >
                    <Bell size={14} />
                    Mark as Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    className="btn btn--ghost btn--full"
                    onClick={() => handleStatusChange(order.id, 'served')}
                  >
                    <CheckCircle size={14} />
                    Served
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
