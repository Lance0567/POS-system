import { useState, useEffect } from 'react'
import type { Product, Category } from '../types'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MenuView() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [p, c] = await Promise.all([
      window.posAPI.products.getAll(),
      window.posAPI.products.getCategories(),
    ])
    setProducts(p)
    setCategories(c)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggleAvailable = async (product: Product) => {
    await window.posAPI.products.update(product.id, { is_available: product.is_available ? 0 : 1 })
    toast.success(`${product.name} ${product.is_available ? 'disabled' : 'enabled'}`)
    load()
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return
    await window.posAPI.products.delete(product.id)
    toast.success(`${product.name} deleted`)
    load()
  }

  const filtered = products.filter(p => {
    const matchCat = !selectedCat || p.category_id === selectedCat
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Menu Management</h1>
        <button className="btn btn--primary">
          <Plus size={14} />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search menu items..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="category-tabs" style={{ flex: 1 }}>
          <button className={`category-tab ${!selectedCat ? 'active' : ''}`} onClick={() => setSelectedCat(null)}>All</button>
          {categories.map(c => (
            <button key={c.id} className={`category-tab ${selectedCat === c.id ? 'active' : ''}`} onClick={() => setSelectedCat(c.id)}
              style={selectedCat === c.id ? { background: c.color, borderColor: c.color } : {}}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Item', 'Category', 'Price', 'Variants', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((product, i) => (
              <tr key={product.id} style={{ borderBottom: '1px solid var(--color-border)', opacity: product.is_available ? 1 : 0.5 }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
                  {product.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{product.description.slice(0, 50)}</div>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className="badge badge--primary">{product.category_name}</span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-accent)' }}>
                  ₱{product.base_price.toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
                  {product.variants?.length ? `${product.variants.length} sizes` : '—'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className={`badge ${product.is_available ? 'badge--success' : 'badge--danger'}`}>
                    {product.is_available ? 'Available' : 'Unavailable'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn--ghost btn--icon btn--sm" onClick={() => toggleAvailable(product)} title="Toggle availability">
                      {product.is_available ? <ToggleRight size={14} color="var(--color-success)" /> : <ToggleLeft size={14} />}
                    </button>
                    <button className="btn btn--ghost btn--icon btn--sm" title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn--ghost btn--icon btn--sm" title="Delete" onClick={() => handleDelete(product)}>
                      <Trash2 size={14} color="var(--color-danger)" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
