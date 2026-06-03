import { ipcMain } from 'electron'
import { getDb } from '../services/database'
import { app } from 'electron'
import { join } from 'path'
import { writeFileSync } from 'fs'

export function registerReportHandlers() {
  const db = getDb()

  ipcMain.handle('reports:getDailySummary', (_, date: string) => {
    const orders = db.prepare(`
      SELECT COUNT(*) as total_orders,
             SUM(total) as gross_sales,
             SUM(discount_amount) as total_discounts,
             SUM(total) as net_sales
      FROM orders WHERE date(created_at) = date(?) AND status = 'completed'
    `).get(date) as Record<string, number>

    const byType = db.prepare(`
      SELECT type, COUNT(*) as count, SUM(total) as amount
      FROM orders WHERE date(created_at) = date(?) AND status = 'completed'
      GROUP BY type
    `).all(date)

    const byPaymentMethod = db.prepare(`
      SELECT p.method, COUNT(*) as count, SUM(p.amount) as amount
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      WHERE date(o.created_at) = date(?) AND o.status = 'completed'
      GROUP BY p.method
    `).all(date)

    const voidedOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders
      WHERE date(created_at) = date(?) AND status = 'voided'
    `).get(date) as { count: number }

    return { date, orders, byType, byPaymentMethod, voidedOrders }
  })

  ipcMain.handle('reports:getSalesByItem', (_, from: string, to: string) => {
    return db.prepare(`
      SELECT oi.name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_sales
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE date(o.created_at) BETWEEN date(?) AND date(?) AND o.status = 'completed'
      GROUP BY oi.name
      ORDER BY total_sales DESC
      LIMIT 50
    `).all(from, to)
  })

  ipcMain.handle('reports:getSalesByStaff', (_, from: string, to: string) => {
    return db.prepare(`
      SELECT u.name as staff_name, u.role,
             COUNT(o.id) as total_orders,
             SUM(o.total) as total_sales
      FROM orders o
      JOIN users u ON o.cashier_id = u.id
      WHERE date(o.created_at) BETWEEN date(?) AND date(?) AND o.status = 'completed'
      GROUP BY o.cashier_id
      ORDER BY total_sales DESC
    `).all(from, to)
  })

  ipcMain.handle('reports:getHourlyTrends', (_, date: string) => {
    return db.prepare(`
      SELECT strftime('%H', created_at) as hour,
             COUNT(*) as order_count,
             SUM(total) as sales
      FROM orders
      WHERE date(created_at) = date(?) AND status = 'completed'
      GROUP BY hour ORDER BY hour
    `).all(date)
  })

  ipcMain.handle('reports:exportCsv', (_, type: string, from: string, to: string) => {
    let data: Record<string, unknown>[] = []
    let filename = ''

    if (type === 'sales_by_item') {
      data = db.prepare(`
        SELECT oi.name as "Item", SUM(oi.quantity) as "Qty Sold",
               SUM(oi.total_price) as "Total Sales"
        FROM order_items oi JOIN orders o ON oi.order_id = o.id
        WHERE date(o.created_at) BETWEEN date(?) AND date(?) AND o.status = 'completed'
        GROUP BY oi.name ORDER BY "Total Sales" DESC
      `).all(from, to) as Record<string, unknown>[]
      filename = `sales_by_item_${from}_to_${to}.csv`
    } else if (type === 'orders') {
      data = db.prepare(`
        SELECT o.order_number as "Order #", o.type as "Type", o.status as "Status",
               o.total as "Total", o.created_at as "Date",
               u.name as "Cashier"
        FROM orders o LEFT JOIN users u ON o.cashier_id = u.id
        WHERE date(o.created_at) BETWEEN date(?) AND date(?)
        ORDER BY o.created_at DESC
      `).all(from, to) as Record<string, unknown>[]
      filename = `orders_${from}_to_${to}.csv`
    }

    if (!data.length) return { success: false, message: 'No data found' }

    const headers = Object.keys(data[0])
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n')
    const exportPath = join(app.getPath('downloads'), filename)
    writeFileSync(exportPath, csv, 'utf-8')
    return { success: true, path: exportPath }
  })
}
