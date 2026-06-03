import { useState } from 'react'
import type { Product, Variant, Addon, AddonGroup } from '../types'
import { X, Plus, Minus } from 'lucide-react'

interface Props {
  product: Product
  onAdd: (variant: Variant | null, addons: { id?: number; name: string; price: number }[]) => void
  onClose: () => void
}

export default function ItemCustomizeModal({ product, onAdd, onClose }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    product.variants?.[0] ?? null
  )
  const [selectedAddons, setSelectedAddons] = useState<Record<number, Addon[]>>({})
  const [notes, setNotes] = useState('')
  const [quantity, setQuantity] = useState(1)

  const toggleAddon = (group: AddonGroup, addon: Addon) => {
    setSelectedAddons(prev => {
      const current = prev[group.id] ?? []
      const exists = current.find(a => a.id === addon.id)
      if (exists) {
        return { ...prev, [group.id]: current.filter(a => a.id !== addon.id) }
      }
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [addon] }
      }
      if (current.length >= group.max_select) return prev
      return { ...prev, [group.id]: [...current, addon] }
    })
  }

  const allAddons = Object.values(selectedAddons).flat()
  const variantPrice = selectedVariant?.price_modifier ?? 0
  const addonsPrice = allAddons.reduce((s, a) => s + a.price, 0)
  const unitPrice = product.base_price + variantPrice + addonsPrice
  const totalPrice = unitPrice * quantity

  const handleAdd = () => {
    for (let i = 0; i < quantity; i++) {
      onAdd(selectedVariant, allAddons.map(a => ({ id: a.id, name: a.name, price: a.price })))
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{product.name}</div>
            {product.description && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{product.description}</div>
            )}
          </div>
          <button className="btn btn--ghost btn--icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal__body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <div className="form-label" style={{ marginBottom: 8 }}>Size / Variant</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {product.variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${selectedVariant?.id === v.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: selectedVariant?.id === v.id ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                      color: selectedVariant?.id === v.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-family)',
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'all 0.15s',
                    }}
                  >
                    {v.name}
                    {v.price_modifier !== 0 && (
                      <span style={{ marginLeft: 4, fontSize: 12, opacity: 0.8 }}>
                        ({v.price_modifier > 0 ? '+' : ''}₱{v.price_modifier})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Addon Groups */}
          {product.addon_groups?.map(group => (
            <div key={group.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="form-label">{group.name}</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {group.is_required ? 'Required' : 'Optional'}
                  {group.max_select > 1 ? ` • Max ${group.max_select}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {group.addons.map(addon => {
                  const isSelected = (selectedAddons[group.id] ?? []).some(a => a.id === addon.id)
                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(group, addon)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface-2)',
                        color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                        fontSize: 12,
                        fontWeight: 500,
                        transition: 'all 0.15s',
                      }}
                    >
                      {addon.name}
                      {addon.price > 0 && ` +₱${addon.price}`}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Special Instructions (Optional)</label>
            <input
              className="input"
              placeholder="e.g. No onions, extra spicy..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal__footer" style={{ alignItems: 'center' }}>
          {/* Quantity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginRight: 'auto' }}>
            <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
              <Minus size={12} />
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{quantity}</span>
            <button className="qty-btn" onClick={() => setQuantity(q => q + 1)}>
              <Plus size={12} />
            </button>
          </div>

          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary btn--lg" onClick={handleAdd}>
            Add to Order · ₱{totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  )
}
