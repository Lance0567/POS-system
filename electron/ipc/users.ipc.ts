import { ipcMain } from 'electron'
import { getDb } from '../services/database'

export function registerUserHandlers() {
  const db = getDb()

  ipcMain.handle('users:getAll', () => {
    return db.prepare('SELECT id, name, role, is_active, created_at FROM users ORDER BY role, name').all()
  })

  ipcMain.handle('users:login', (_, pin: string) => {
    const user = db.prepare('SELECT id, name, role, is_active FROM users WHERE pin = ? AND is_active = 1').get(pin) as Record<string, unknown> | undefined
    if (!user) return { success: false, message: 'Invalid PIN' }
    return { success: true, user }
  })

  ipcMain.handle('users:create', (_, data: Record<string, unknown>) => {
    const existing = db.prepare('SELECT id FROM users WHERE pin = ?').get(data.pin)
    if (existing) return { success: false, message: 'PIN already in use' }
    const result = db.prepare('INSERT INTO users (name, pin, role) VALUES (?, ?, ?)').run(data.name, data.pin, data.role || 'cashier')
    return { success: true, id: result.lastInsertRowid }
  })

  ipcMain.handle('users:update', (_, id: number, data: Record<string, unknown>) => {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
    const values = Object.values(data)
    db.prepare(`UPDATE users SET ${fields}, updated_at = datetime('now') WHERE id = ?`).run(...values, id)
    return { success: true }
  })

  ipcMain.handle('users:delete', (_, id: number) => {
    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id)
    return { success: true }
  })
}
