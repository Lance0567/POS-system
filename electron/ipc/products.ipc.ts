import { ipcMain } from 'electron'
import { getDb } from '../services/database'

export function registerProductHandlers() {
  const db = getDb()

  ipcMain.handle('products:getCategories', () => {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all()
  })

  ipcMain.handle('products:getAll', () => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.color as category_color
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.sort_order, p.name
    `).all() as Record<string, unknown>[]

    for (const product of products) {
      product.variants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order').all(product.id as number)
      product.addon_groups = db.prepare('SELECT * FROM addon_groups WHERE product_id = ?').all(product.id as number) as Record<string, unknown>[]
      for (const group of product.addon_groups as Record<string, unknown>[]) {
        group.addons = db.prepare('SELECT * FROM addons WHERE addon_group_id = ?').all(group.id as number)
      }
    }
    return products
  })

  ipcMain.handle('products:getVariants', (_, productId: number) => {
    return db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY sort_order').all(productId)
  })

  ipcMain.handle('products:getAddons', (_, productId: number) => {
    const groups = db.prepare('SELECT * FROM addon_groups WHERE product_id = ?').all(productId) as Record<string, unknown>[]
    for (const group of groups) {
      group.addons = db.prepare('SELECT * FROM addons WHERE addon_group_id = ?').all(group.id as number)
    }
    return groups
  })

  ipcMain.handle('products:getCombos', () => {
    const combos = db.prepare('SELECT * FROM combos WHERE is_available = 1').all() as Record<string, unknown>[]
    for (const combo of combos) {
      combo.items = db.prepare(`
        SELECT ci.*, p.name as product_name FROM combo_items ci
        JOIN products p ON ci.product_id = p.id WHERE ci.combo_id = ?
      `).all(combo.id as number)
    }
    return combos
  })

  ipcMain.handle('products:create', (_, data: Record<string, unknown>) => {
    const stmt = db.prepare(`
      INSERT INTO products (category_id, name, description, base_price, image_url, is_available, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `)
    const result = stmt.run(data.category_id, data.name, data.description || null, data.base_price || 0, data.image_url || null, data.sort_order || 0)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('products:update', (_, id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    db.prepare(`UPDATE products SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
    return { success: true }
  })

  ipcMain.handle('products:delete', (_, id: number) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(id)
    return { success: true }
  })
}
