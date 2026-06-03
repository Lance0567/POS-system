import { useState } from 'react'
import type { PaymentMethod } from '../types'
import { X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface PaymentModalProps {
  orderId: number
  total: number
  orderNumber: string
  onClose: () => void
  onSuccess: () => void
}

const PAYMENT_METHODS: { method: PaymentMethod; label: string; emoji: string; needsRef?: boolean; needsTendered?: boolean }[] = [
  { method: 'cash', label: 'Cash', emoji: '💵', needsTendered: true },
  { method: 'card', label: 'Card', emoji: '💳', needsRef: true },
  { method: 'gcash', label: 'GCash', emoji: '📱', needsRef: true },
  { method: 'maya', label: 'Maya', emoji: '🟣', needsRef: true },
  { method: 'grabfood', label: 'GrabFood', emoji: '🟢', needsRef: true },
  { method: 'foodpanda', label: 'Foodpanda', emoji: '🐼', needsRef: true },
]

const QUICK_CASH = [20, 50, 100, 200, 500, 1000]

export default function PaymentModal({ orderId, total, orderNumber, onClose, onSuccess }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash')
  const [tendered, setTendered] = useState('')
  const [reference, setReference] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const [changeAmount, setChangeAmount] = useState(0)

  const methodConfig = PAYMENT_METHODS.find(m => m.method === selectedMethod)!
  const tenderedAmount = parseFloat(tendered) || 0
  const change = selectedMethod === 'cash' ? Math.max(0, tenderedAmount - total) : 0

  const handleProcess = async () => {
    if (selectedMethod === 'cash' && tenderedAmount < total) {
      toast.error('Tendered amount is less than total')
      return
    }
    if (methodConfig.needsRef && !reference) {
      toast.error('Please enter a reference number')
      return
    }

    setIsProcessing(true)
    try {
      const result = await window.posAPI.payments.process({
        order_id: orderId,
        method: selectedMethod,
        amount: total,
        tendered: selectedMethod === 'cash' ? tenderedAmount : total,
        reference_no: reference || undefined,
      })
      setChangeAmount(result.change)
      setPaymentDone(true)
      setTimeout(() => onSuccess(), 2500)
    } catch (err) {
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (paymentDone) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
            Payment Complete!
          </div>
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 24 }}>
            Order #{orderNumber}
          </div>
          {changeAmount > 0 && (
            <div className="change-display" style={{ marginBottom: 16 }}>
              <span className="change-display__label">Change</span>
              <span className="change-display__amount">₱{changeAmount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Redirecting...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--lg" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal__header">
          <div>
            <div className="modal__title">Process Payment</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Order #{orderNumber}</div>
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Total */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
              Amount Due
            </div>
            <div className="amount-total">
              <span className="amount-total__currency">₱</span>
              {total.toFixed(2)}
            </div>
          </div>

          {/* Payment Methods */}
          <div>
            <div className="form-label" style={{ marginBottom: 8 }}>Payment Method</div>
            <div className="payment-methods">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.method}
                  className={`payment-method-btn ${selectedMethod === m.method ? 'selected' : ''}`}
                  onClick={() => { setSelectedMethod(m.method); setTendered(''); setReference('') }}
                >
                  <span className="payment-method-btn__icon">{m.emoji}</span>
                  <span className="payment-method-btn__label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash tendered */}
          {selectedMethod === 'cash' && (
            <div className="cash-input-section">
              <div className="form-group">
                <label className="form-label">Cash Tendered</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0.00"
                  value={tendered}
                  onChange={e => setTendered(e.target.value)}
                  style={{ fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                />
              </div>
              <div className="quick-cash">
                {QUICK_CASH.filter(v => v >= total * 0.5).slice(0, 6).map(v => (
                  <button
                    key={v}
                    className="quick-cash-btn"
                    onClick={() => setTendered(String(v))}
                  >
                    ₱{v}
                  </button>
                ))}
                <button className="quick-cash-btn" onClick={() => setTendered(String(Math.ceil(total)))}>
                  Exact
                </button>
              </div>
              {tenderedAmount >= total && (
                <div className="change-display">
                  <span className="change-display__label">Change</span>
                  <span className="change-display__amount">₱{change.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Reference number */}
          {methodConfig.needsRef && (
            <div className="form-group">
              <label className="form-label">Reference / Transaction Number</label>
              <input
                className="input"
                placeholder="e.g. GC-123456789"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </button>
          <button
            className="btn btn--success btn--lg"
            onClick={handleProcess}
            disabled={isProcessing}
            style={{ minWidth: 160 }}
          >
            {isProcessing ? 'Processing...' : (
              <>
                <CheckCircle size={16} />
                Confirm Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
