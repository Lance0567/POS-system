import { ipcMain } from 'electron'
import { getDb } from '../services/database'

export function registerTableHandlers() {
  const db = getDb()

  ipcMain.handle('tables:getAll', () => {
    return db.prepare(`
      SELECT t.*, o.order_number, o.status as order_status, o.total as order_total
      FROM tables t
      LEFT JOIN orders o ON t.current_order_id = o.id
      ORDER BY t.section, t.name
    `).all()
  })

  ipcMain.handle('tables:create', (_, data: Record<string, unknown>) => {
    const result = db.prepare('INSERT INTO tables (name, section, capacity) VALUES (?, ?, ?)').run(
      data.name, data.section || 'Main', data.capacity || 4
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('tables:update', (_, id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    db.prepare(`UPDATE tables SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...Object.values(data), id)
    return { success: true }
  })

  ipcMain.handle('tables:delete', (_, id: number) => {
    db.prepare('DELETE FROM tables WHERE id = ?').run(id)
    return { success: true }
  })
}
