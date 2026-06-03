import { ipcMain } from 'electron'
import { getDb } from '../services/database'

export function registerPaymentHandlers() {
  const db = getDb()

  ipcMain.handle('payments:process', (_, data: {
    order_id: number
    method: string
    amount: number
    tendered?: number
    reference_no?: string
  }) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(data.order_id) as Record<string, unknown> | undefined
    if (!order) throw new Error('Order not found')

    const change = (data.tendered || 0) - data.amount

    const stmt = db.prepare(`
      INSERT INTO payments (order_id, method, amount, tendered, change_amount, reference_no)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(data.order_id, data.method, data.amount, data.tendered || data.amount, Math.max(0, change), data.reference_no || null)

    // Mark order as completed
    db.prepare(`
      UPDATE orders SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(data.order_id)

    // Free up the table
    if (order.table_id) {
      db.prepare("UPDATE tables SET status = 'available', current_order_id = NULL WHERE id = ?").run(order.table_id)
    }

    return {
      id: result.lastInsertRowid,
      change: Math.max(0, change),
      order_number: order.order_number,
    }
  })

  ipcMain.handle('payments:getByOrder', (_, orderId: number) => {
    return db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderId)
  })

  ipcMain.handle('payments:applyDiscount', (_, data: {
    order_id: number
    type: string
    label: string
    value: number
    is_percentage: boolean
  }) => {
    // Remove existing modifier of same type
    db.prepare('DELETE FROM order_modifiers WHERE order_id = ? AND type = ?').run(data.order_id, data.type)
    
    const stmt = db.prepare(`
      INSERT INTO order_modifiers (order_id, type, label, value, is_percentage)
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(data.order_id, data.type, data.label, data.value, data.is_percentage ? 1 : 0)

    // Recalculate totals
    const items = db.prepare('SELECT SUM(total_price) as total FROM order_items WHERE order_id = ?').get(data.order_id) as { total: number }
    const subtotal = items.total || 0
    const mods = db.prepare('SELECT * FROM order_modifiers WHERE order_id = ?').all(data.order_id) as { value: number; is_percentage: number }[]
    let discountAmount = 0
    for (const mod of mods) {
      discountAmount += mod.is_percentage ? subtotal * (mod.value / 100) : mod.value
    }
    const total = Math.max(0, subtotal - discountAmount)
    db.prepare("UPDATE orders SET discount_amount = ?, total = ?, updated_at = datetime('now') WHERE id = ?")
      .run(discountAmount, total, data.order_id)

    return { id: result.lastInsertRowid, success: true }
  })

  ipcMain.handle('payments:validateVoucher', (_, code: string) => {
    const voucher = db.prepare(`
      SELECT * FROM vouchers 
      WHERE code = ? AND is_active = 1 
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND (usage_limit IS NULL OR usage_count < usage_limit)
    `).get(code) as Record<string, unknown> | undefined

    if (!voucher) return { valid: false, message: 'Invalid or expired voucher code' }
    return { valid: true, voucher }
  })

  ipcMain.handle('payments:removeDiscount', (_, orderId: number, type: string) => {
    db.prepare('DELETE FROM order_modifiers WHERE order_id = ? AND type = ?').run(orderId, type)
    // Recalculate totals
    const items = db.prepare('SELECT SUM(total_price) as total FROM order_items WHERE order_id = ?').get(orderId) as { total: number }
    const subtotal = items.total || 0
    const mods = db.prepare('SELECT * FROM order_modifiers WHERE order_id = ?').all(orderId) as { value: number; is_percentage: number }[]
    let discountAmount = 0
    for (const mod of mods) {
      discountAmount += mod.is_percentage ? subtotal * (mod.value / 100) : mod.value
    }
    const total = Math.max(0, subtotal - discountAmount)
    db.prepare("UPDATE orders SET discount_amount = ?, total = ?, updated_at = datetime('now') WHERE id = ?")
      .run(discountAmount, total, orderId)
    return { success: true, subtotal, discountAmount, total }
  })
}
