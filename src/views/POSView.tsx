import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cart.store'
import { useSessionStore } from '../stores/session.store'
import type { Product, Category, CartItem, Variant, AddonGroup, OrderType } from '../types'
import toast from 'react-hot-toast'
import {
  Search, Trash2, Plus, Minus, CreditCard,
  ShoppingCart, ArrowLeft, StickyNote, Percent, Tag
} from 'lucide-react'
import PaymentModal from '../components/PaymentModal'
import ItemCustomizeModal from '../components/ItemCustomizeModal'

const CATEGORY_ICONS: Record<string, string> = {
  utensils: '🍽️', coffee: '☕', cake: '🍰', pizza: '🍕',
  beef: '🥩', fish: '🐟', salad: '🥗', 'plus-circle': '➕',
}

const ORDER_TYPE_OPTIONS: { value: OrderType; label: string; emoji: string }[] = [
  { value: 'dine_in', label: 'Dine In', emoji: '🍽️' },
  { value: 'takeout', label: 'Takeout', emoji: '🛍️' },
  { value: 'delivery', label: 'Delivery', emoji: '🛵' },
  { value: 'grabfood', label: 'GrabFood', emoji: '🟢' },
  { value: 'foodpanda', label: 'Foodpanda', emoji: '🐼' },
]

export default function POSView() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const { user } = useSessionStore()
  const cart = useCartStore()

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [customizeItem, setCustomizeItem] = useState<Product | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  const [showDiscountRow, setShowDiscountRow] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)

  // Track applied discount types so we can show remove buttons
  const [appliedDiscounts, setAppliedDiscounts] = useState<{ type: string; label: string }[]>([])

  // Load menu data once
  useEffect(() => {
    window.posAPI.products.getCategories().then(cats => {
      setCategories(cats)
      if (cats.length) setSelectedCategory(cats[0].id)
    })
    window.posAPI.products.getAll().then(setProducts)
  }, [])

  // When tableId changes, ALWAYS start a fresh cart then create a new order
  useEffect(() => {
    // Reset all local + cart state so nothing bleeds from a previous order
    cart.clearCart()
    setShowDiscountRow(false)
    setDiscountCode('')
    setAppliedDiscounts([])

    if (tableId) {
      setIsCreatingOrder(true)
      window.posAPI.orders.create({
        table_id: parseInt(tableId),
        type: 'dine_in',
        cashier_id: user?.id,
      }).then(result => {
        cart.setOrder(result.id, result.order_number)
        cart.setTable(parseInt(tableId))
        cart.setOrderType('dine_in')
      }).finally(() => setIsCreatingOrder(false))
    }
  }, [tableId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProducts = products.filter(p => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleProductClick = (product: Product) => {
    if (!product.is_available) return
    // If product has variants or addon groups, show customize modal
    if ((product.variants?.length ?? 0) > 0 || (product.addon_groups?.length ?? 0) > 0) {
      setCustomizeItem(product)
    } else {
      addToCart(product, null, [])
    }
  }

  const addToCart = useCallback(async (
    product: Product,
    variant: Variant | null,
    addons: { id?: number; name: string; price: number }[]
  ) => {
    if (!cart.orderId) {
      // Create a quick order without table
      const result = await window.posAPI.orders.create({
        type: cart.orderType,
        cashier_id: user?.id,
      })
      cart.setOrder(result.id, result.order_number)
    }

    const variantPrice = variant?.price_modifier ?? 0
    const addonsPrice = addons.reduce((sum, a) => sum + a.price, 0)
    const unitPrice = product.base_price + variantPrice + addonsPrice

    const item: CartItem = {
      product_id: product.id,
      variant_id: variant?.id,
      name: product.name + (variant ? ` (${variant.name})` : ''),
      quantity: 1,
      unit_price: unitPrice,
      addons,
    }

    cart.addItem(item)

    // Persist to DB
    if (cart.orderId) {
      await window.posAPI.orders.addItem(cart.orderId, item)
    }

    toast.success(`${item.name} added`, { duration: 1200 })
  }, [cart, user])

  const handleRemoveItem = async (index: number) => {
    cart.removeItem(index)
    // Note: In full implementation, call orders.removeItem with the DB item ID
  }

  const handleApplyDiscount = async (type: 'sc' | 'pwd' | 'voucher') => {
    if (!cart.orderId) return
    let discountData
    let label = ''
    if (type === 'sc') {
      discountData = { order_id: cart.orderId, type: 'sc_discount', label: 'Senior Citizen (20%)', value: 20, is_percentage: true }
      label = 'Senior Citizen 20%'
    } else if (type === 'pwd') {
      discountData = { order_id: cart.orderId, type: 'pwd_discount', label: 'PWD Discount (20%)', value: 20, is_percentage: true }
      label = 'PWD 20%'
    } else {
      const result = await window.posAPI.payments.validateVoucher(discountCode)
      if (!result.valid || !result.voucher) { toast.error(result.message || 'Invalid voucher'); return }
      discountData = {
        order_id: cart.orderId,
        type: 'voucher',
        label: `Voucher: ${result.voucher.code}`,
        value: result.voucher.discount_value,
        is_percentage: result.voucher.discount_type === 'percentage',
      }
      label = `Voucher: ${result.voucher.code}`
    }
    await window.posAPI.payments.applyDiscount(discountData)
    const order = await window.posAPI.orders.getById(cart.orderId)
    if (order) cart.setTotals(order.subtotal, order.discount_amount, order.total)
    // Track the applied discount so we can show a Remove button
    const discountType = type === 'sc' ? 'sc_discount' : type === 'pwd' ? 'pwd_discount' : 'voucher'
    setAppliedDiscounts(prev => [
      ...prev.filter(d => d.type !== discountType),
      { type: discountType, label },
    ])
    toast.success('Discount applied!')
  }

  const handleRemoveDiscount = async (discountType: string) => {
    if (!cart.orderId) return
    const result = await window.posAPI.payments.removeDiscount(cart.orderId, discountType)
    cart.setTotals(result.subtotal, result.discountAmount, result.total)
    setAppliedDiscounts(prev => prev.filter(d => d.type !== discountType))
    if (result.discountAmount === 0) setShowDiscountRow(false)
    toast.success('Discount removed')
  }

  const subtotal = cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity + (item.addons?.reduce((s, a) => s + a.price * item.quantity, 0) ?? 0), 0)
  const displayTotal = cart.orderId ? cart.total : subtotal

  return (
    <div className="pos-layout">
      {/* Product Area */}
      <div className="product-grid-area">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn--ghost btn--icon" onClick={() => navigate('/tables')}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              placeholder="Search menu..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Order type selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {ORDER_TYPE_OPTIONS.slice(0, 3).map(opt => (
              <button
                key={opt.value}
                className={`btn btn--sm ${cart.orderType === opt.value ? 'btn--primary' : 'btn--ghost'}`}
                onClick={() => cart.setOrderType(opt.value)}
                title={opt.label}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs">
          <button
            className={`category-tab ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-tab ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
              style={selectedCategory === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
            >
              {CATEGORY_ICONS[cat.icon] || '🍴'} {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="product-grid">
          {filteredProducts.map((product, i) => (
            <div
              key={product.id}
              className={`product-card ${!product.is_available ? 'product-card--unavailable' : ''}`}
              onClick={() => handleProductClick(product)}
              style={{ animationDelay: `${i * 20}ms` }}
            >
              <div className="product-card__emoji">
                {CATEGORY_ICONS[product.category_name?.toLowerCase() || ''] || '🍴'}
              </div>
              <div className="product-card__name">{product.name}</div>
              {product.description && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                  {product.description.slice(0, 40)}...
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                <div className="product-card__price">₱{product.base_price.toFixed(2)}</div>
                {(product.variants?.length ?? 0) > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 5px' }}>
                    Variants
                  </span>
                )}
              </div>
              {!product.is_available && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 'var(--radius-lg)', fontSize: 11, fontWeight: 700, color: 'var(--color-danger)' }}>
                  UNAVAILABLE
                </div>
              )}
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              No items found
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div className="cart-panel">
        <div className="cart-panel__header">
          <div>
            <div className="cart-panel__title">
              {cart.orderNumber ? `#${cart.orderNumber}` : 'New Order'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {cart.items.length} item{cart.items.length !== 1 ? 's' : ''}
            </div>
          </div>
          {cart.items.length > 0 && (
            <button
              className="btn btn--danger btn--sm"
              onClick={() => { cart.clearCart(); }}
              title="Clear cart"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {cart.items.length === 0 ? (
          <div className="cart-empty">
            <div className="cart-empty__icon"><ShoppingCart /></div>
            <div className="cart-empty__text">No items yet.<br />Tap a menu item to add it.</div>
          </div>
        ) : (
          <div className="cart-panel__items">
            {cart.items.map((item, i) => (
              <div key={i} className="cart-item">
                <div className="cart-item__qty">
                  <button className="qty-btn" onClick={() => cart.updateItemQty(i, item.quantity - 1)}>
                    <Minus size={10} />
                  </button>
                  <span className="qty-count">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => cart.updateItemQty(i, item.quantity + 1)}>
                    <Plus size={10} />
                  </button>
                </div>
                <div className="cart-item__info">
                  <div className="cart-item__name">{item.name}</div>
                  {item.addons && item.addons.length > 0 && (
                    <div className="cart-item__addons">
                      + {item.addons.map(a => a.name).join(', ')}
                    </div>
                  )}
                  {item.notes && (
                    <div className="cart-item__addons">📝 {item.notes}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="cart-item__price">
                    ₱{(item.unit_price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                    onClick={() => handleRemoveItem(i)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="cart-panel__footer">
          {/* Discount row */}
          {cart.items.length > 0 && (
            <div>
              {/* Show applied discounts with remove buttons */}
              {appliedDiscounts.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                  {appliedDiscounts.map(d => (
                    <div key={d.type} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', background: 'var(--color-success-light)',
                      border: '1px solid var(--color-success)', borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                    }}>
                      <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>✓ {d.label}</span>
                      <button
                        onClick={() => handleRemoveDiscount(d.type)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                        title="Remove discount"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {!showDiscountRow ? (
                <button
                  className="btn btn--ghost btn--sm btn--full"
                  onClick={() => setShowDiscountRow(true)}
                  style={{ fontSize: 12 }}
                >
                  <Percent size={12} />
                  Apply Discount / Voucher
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Discounts</span>
                    <button className="btn btn--ghost btn--sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setShowDiscountRow(false)}>Hide</button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleApplyDiscount('sc')} style={{ flex: 1, fontSize: 11 }}>
                      👴 SC 20%
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => handleApplyDiscount('pwd')} style={{ flex: 1, fontSize: 11 }}>
                      ♿ PWD 20%
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      className="input"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                      placeholder="Voucher code..."
                      value={discountCode}
                      onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                    />
                    <button className="btn btn--primary btn--sm" onClick={() => handleApplyDiscount('voucher')}>
                      <Tag size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="cart-totals">
            <div className="cart-total-row">
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            {cart.discountAmount > 0 && (
              <div className="cart-total-row" style={{ color: 'var(--color-success)' }}>
                <span>Discount</span>
                <span>-₱{cart.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="cart-total-row cart-total-row--grand">
              <span>Total</span>
              <span>₱{displayTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            className="btn btn--success btn--full btn--lg"
            onClick={() => setShowPayment(true)}
            disabled={cart.items.length === 0}
          >
            <CreditCard size={18} />
            Charge ₱{displayTotal.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showPayment && cart.orderId && (
        <PaymentModal
          orderId={cart.orderId}
          total={displayTotal}
          orderNumber={cart.orderNumber || ''}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            cart.clearCart()
            navigate('/tables')
            toast.success('Payment complete! 🎉')
          }}
        />
      )}

      {customizeItem && (
        <ItemCustomizeModal
          product={customizeItem}
          onAdd={(variant, addons) => {
            addToCart(customizeItem, variant, addons)
            setCustomizeItem(null)
          }}
          onClose={() => setCustomizeItem(null)}
        />
      )}
    </div>
  )
}
