import { ipcMain } from 'electron'
import { getDb } from '../services/database'

function generateOrderNumber(): string {
  const db = getDb()
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'order_number_counter'").get() as { value: string } | undefined
  const prefix = (db.prepare("SELECT value FROM settings WHERE key = 'order_number_prefix'").get() as { value: string } | undefined)?.value || 'ORD'
  const counter = parseInt(setting?.value || '1', 10)
  db.prepare("UPDATE settings SET value = ? WHERE key = 'order_number_counter'").run(String(counter + 1))
  return `${prefix}-${String(counter).padStart(5, '0')}`
}

export function registerOrderHandlers() {
  const db = getDb()

  ipcMain.handle('orders:getAll', (_, filters: { status?: string; date?: string; type?: string } = {}) => {
    let query = `
      SELECT o.*, u1.name as cashier_name, u2.name as waiter_name, t.name as table_name
      FROM orders o
      LEFT JOIN users u1 ON o.cashier_id = u1.id
      LEFT JOIN users u2 ON o.waiter_id = u2.id
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE 1=1
    `
    const params: unknown[] = []
    if (filters.status) { query += ' AND o.status = ?'; params.push(filters.status) }
    if (filters.date) { query += " AND date(o.created_at) = date(?)"; params.push(filters.date) }
    if (filters.type) { query += ' AND o.type = ?'; params.push(filters.type) }
    query += ' ORDER BY o.created_at DESC LIMIT 100'
    return db.prepare(query).all(...params)
  })

  ipcMain.handle('orders:getActive', () => {
    return db.prepare(`
      SELECT o.*, u1.name as cashier_name, u2.name as waiter_name, t.name as table_name
      FROM orders o
      LEFT JOIN users u1 ON o.cashier_id = u1.id
      LEFT JOIN users u2 ON o.waiter_id = u2.id
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.status NOT IN ('completed', 'voided')
      ORDER BY o.created_at DESC
    `).all()
  })

  ipcMain.handle('orders:getById', (_, id: number) => {
    const order = db.prepare(`
      SELECT o.*, u1.name as cashier_name, u2.name as waiter_name, t.name as table_name
      FROM orders o
      LEFT JOIN users u1 ON o.cashier_id = u1.id
      LEFT JOIN users u2 ON o.waiter_id = u2.id
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
    `).get(id)

    if (!order) return null

    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, v.name as variant_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN variants v ON oi.variant_id = v.id
      WHERE oi.order_id = ?
    `).all(id)

    for (const item of items as Record<string, unknown>[]) {
      item.addons = db.prepare('SELECT * FROM order_item_addons WHERE order_item_id = ?').all(item.id as number)
    }

    const modifiers = db.prepare('SELECT * FROM order_modifiers WHERE order_id = ?').all(id)
    const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(id)

    return { ...order as object, items, modifiers, payments }
  })

  ipcMain.handle('orders:create', (_, data: Record<string, unknown>) => {
    const orderNumber = generateOrderNumber()
    const stmt = db.prepare(`
      INSERT INTO orders (order_number, table_id, type, status, cashier_id, waiter_id, customer_name, customer_count, notes)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      orderNumber, data.table_id || null, data.type || 'dine_in',
      data.cashier_id || null, data.waiter_id || null,
      data.customer_name || null, data.customer_count || 1, data.notes || null
    )
    if (data.table_id) {
      db.prepare("UPDATE tables SET status = 'occupied', current_order_id = ? WHERE id = ?")
        .run(result.lastInsertRowid, data.table_id)
    }
    return { id: result.lastInsertRowid, order_number: orderNumber }
  })

  ipcMain.handle('orders:update', (_, id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    db.prepare(`UPDATE orders SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
    return { success: true }
  })

  ipcMain.handle('orders:addItem', (_, orderId: number, item: Record<string, unknown>) => {
    const stmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, combo_id, variant_id, name, quantity, unit_price, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const totalPrice = ((item.unit_price as number) || 0) * ((item.quantity as number) || 1)
    const result = stmt.run(
      orderId, item.product_id || null, item.combo_id || null,
      item.variant_id || null, item.name, item.quantity || 1,
      item.unit_price || 0, totalPrice, item.notes || null
    )
    const orderItemId = result.lastInsertRowid
    if (item.addons && Array.isArray(item.addons)) {
      const addonStmt = db.prepare('INSERT INTO order_item_addons (order_item_id, addon_id, name, price) VALUES (?, ?, ?, ?)')
      for (const addon of item.addons as Record<string, unknown>[]) {
        addonStmt.run(orderItemId, addon.id || null, addon.name, addon.price || 0)
      }
    }
    recalculateOrderTotals(orderId)
    return { id: orderItemId }
  })

  ipcMain.handle('orders:removeItem', (_, orderItemId: number) => {
    const item = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(orderItemId) as { order_id: number } | undefined
    db.prepare('DELETE FROM order_items WHERE id = ?').run(orderItemId)
    if (item) recalculateOrderTotals(item.order_id)
    return { success: true }
  })

  ipcMain.handle('orders:updateItemStatus', (_, orderItemId: number, status: string) => {
    db.prepare('UPDATE order_items SET status = ? WHERE id = ?').run(status, orderItemId)
    return { success: true }
  })

  ipcMain.handle('orders:void', (_, id: number, reason: string) => {
    db.prepare("UPDATE orders SET status = 'voided', notes = ?, updated_at = datetime('now') WHERE id = ?").run(reason, id)
    const order = db.prepare('SELECT table_id FROM orders WHERE id = ?').get(id) as { table_id: number } | undefined
    if (order?.table_id) {
      db.prepare("UPDATE tables SET status = 'available', current_order_id = NULL WHERE id = ?").run(order.table_id)
    }
    return { success: true }
  })
}

function recalculateOrderTotals(orderId: number) {
  const db = getDb()
  const itemsTotal = (db.prepare('SELECT SUM(total_price) as total FROM order_items WHERE order_id = ?').get(orderId) as { total: number }).total || 0
  const addonsTotal = (db.prepare(`
    SELECT SUM(oia.price * oi.quantity) as total FROM order_item_addons oia
    JOIN order_items oi ON oia.order_item_id = oi.id WHERE oi.order_id = ?
  `).get(orderId) as { total: number }).total || 0
  const subtotal = itemsTotal + addonsTotal
  const modifiers = db.prepare('SELECT * FROM order_modifiers WHERE order_id = ?').all(orderId) as { value: number; is_percentage: number }[]
  let discountAmount = 0
  for (const mod of modifiers) {
    if (mod.is_percentage) discountAmount += subtotal * (mod.value / 100)
    else discountAmount += mod.value
  }
  const total = Math.max(0, subtotal - discountAmount)
  db.prepare("UPDATE orders SET subtotal = ?, discount_amount = ?, total = ?, updated_at = datetime('now') WHERE id = ?")
    .run(subtotal, discountAmount, total, orderId)
}
