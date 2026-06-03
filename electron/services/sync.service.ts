import { ipcMain, BrowserWindow } from 'electron'
import { getDb } from './database'

let syncStatus: 'synced' | 'pending' | 'offline' | 'syncing' = 'offline'
let syncInterval: NodeJS.Timeout | null = null

function broadcastSyncStatus(status: typeof syncStatus) {
  syncStatus = status
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('sync:status', status)
  })
}

export function startSyncEngine() {
  // Register sync status getter
  ipcMain.handle('sync:getStatus', () => syncStatus)

  // Check connectivity and sync every 30 seconds
  syncInterval = setInterval(async () => {
    await attemptSync()
  }, 30_000)

  // Initial sync attempt
  setTimeout(() => attemptSync(), 3000)
}

async function attemptSync() {
  const db = getDb()
  
  // Check if Supabase is configured
  const supabaseUrl = (db.prepare("SELECT value FROM settings WHERE key = 'supabase_url'").get() as { value: string } | undefined)?.value
  const supabaseKey = (db.prepare("SELECT value FROM settings WHERE key = 'supabase_key'").get() as { value: string } | undefined)?.value

  if (!supabaseUrl || !supabaseKey) {
    broadcastSyncStatus('offline')
    return
  }

  // Check connectivity
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: { apikey: supabaseKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error('Supabase unreachable')
  } catch {
    broadcastSyncStatus('offline')
    return
  }

  // Check for pending items
  const pending = db.prepare("SELECT COUNT(*) as count FROM sync_queue WHERE synced_at IS NULL").get() as { count: number }
  
  if (pending.count === 0) {
    broadcastSyncStatus('synced')
    return
  }

  broadcastSyncStatus('syncing')

  // Process sync queue
  const items = db.prepare("SELECT * FROM sync_queue WHERE synced_at IS NULL LIMIT 50").all() as {
    id: number; table_name: string; record_id: number; operation: string; payload: string
  }[]

  let allSynced = true
  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload)
      const endpoint = `${supabaseUrl}/rest/v1/${item.table_name}`
      
      let method = 'POST'
      let url = endpoint
      if (item.operation === 'UPDATE') { method = 'PATCH'; url = `${endpoint}?id=eq.${item.record_id}` }
      else if (item.operation === 'DELETE') { method = 'DELETE'; url = `${endpoint}?id=eq.${item.record_id}` }

      const res = await fetch(url, {
        method,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: item.operation !== 'DELETE' ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(10000),
      })

      if (res.ok || res.status === 409) {
        db.prepare("UPDATE sync_queue SET synced_at = datetime('now') WHERE id = ?").run(item.id)
      } else {
        allSynced = false
        db.prepare("UPDATE sync_queue SET error = ? WHERE id = ?").run(await res.text(), item.id)
      }
    } catch (err) {
      allSynced = false
      db.prepare("UPDATE sync_queue SET error = ? WHERE id = ?").run(String(err), item.id)
    }
  }

  broadcastSyncStatus(allSynced ? 'synced' : 'pending')
}
