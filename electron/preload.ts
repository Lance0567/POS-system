import { contextBridge, ipcRenderer } from 'electron'

// Expose typed API to the renderer process
contextBridge.exposeInMainWorld('posAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    openKds: () => ipcRenderer.send('window:open-kds'),
  },

  // Products & Menu
  products: {
    getAll: () => ipcRenderer.invoke('products:getAll'),
    getCategories: () => ipcRenderer.invoke('products:getCategories'),
    create: (data: unknown) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('products:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id),
    getVariants: (productId: number) => ipcRenderer.invoke('products:getVariants', productId),
    getAddons: (productId: number) => ipcRenderer.invoke('products:getAddons', productId),
    getCombos: () => ipcRenderer.invoke('products:getCombos'),
  },

  // Tables
  tables: {
    getAll: () => ipcRenderer.invoke('tables:getAll'),
    update: (id: number, data: unknown) => ipcRenderer.invoke('tables:update', id, data),
    create: (data: unknown) => ipcRenderer.invoke('tables:create', data),
    delete: (id: number) => ipcRenderer.invoke('tables:delete', id),
  },

  // Orders
  orders: {
    getAll: (filters?: unknown) => ipcRenderer.invoke('orders:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('orders:getById', id),
    getActive: () => ipcRenderer.invoke('orders:getActive'),
    create: (data: unknown) => ipcRenderer.invoke('orders:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('orders:update', id, data),
    addItem: (orderId: number, item: unknown) => ipcRenderer.invoke('orders:addItem', orderId, item),
    removeItem: (orderItemId: number) => ipcRenderer.invoke('orders:removeItem', orderItemId),
    updateItemStatus: (orderItemId: number, status: string) =>
      ipcRenderer.invoke('orders:updateItemStatus', orderItemId, status),
    void: (id: number, reason: string) => ipcRenderer.invoke('orders:void', id, reason),
    onUpdated: (callback: (order: unknown) => void) => {
      ipcRenderer.on('orders:updated', (_, order) => callback(order))
      return () => ipcRenderer.removeAllListeners('orders:updated')
    },
  },

  // Payments
  payments: {
    process: (data: unknown) => ipcRenderer.invoke('payments:process', data),
    getByOrder: (orderId: number) => ipcRenderer.invoke('payments:getByOrder', orderId),
    applyDiscount: (data: unknown) => ipcRenderer.invoke('payments:applyDiscount', data),
    validateVoucher: (code: string) => ipcRenderer.invoke('payments:validateVoucher', code),
    removeDiscount: (orderId: number, type: string) => ipcRenderer.invoke('payments:removeDiscount', orderId, type),
  },

  // Users & Auth
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    login: (pin: string) => ipcRenderer.invoke('users:login', pin),
    create: (data: unknown) => ipcRenderer.invoke('users:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('users:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('users:delete', id),
  },

  // Reports
  reports: {
    getDailySummary: (date: string) => ipcRenderer.invoke('reports:getDailySummary', date),
    getSalesByItem: (from: string, to: string) =>
      ipcRenderer.invoke('reports:getSalesByItem', from, to),
    getSalesByStaff: (from: string, to: string) =>
      ipcRenderer.invoke('reports:getSalesByStaff', from, to),
    getHourlyTrends: (date: string) => ipcRenderer.invoke('reports:getHourlyTrends', date),
    exportCsv: (type: string, from: string, to: string) =>
      ipcRenderer.invoke('reports:exportCsv', type, from, to),
  },

  // Sync status
  sync: {
    onStatusChange: (callback: (status: string) => void) => {
      ipcRenderer.on('sync:status', (_, status) => callback(status))
      return () => ipcRenderer.removeAllListeners('sync:status')
    },
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.send('shell:open-external', url),
  },
})
