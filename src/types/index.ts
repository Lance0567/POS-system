// Global type declarations for the Electron preload API
export {}

declare global {
  interface Window {
    posAPI: {
      window: {
        minimize: () => void
        maximize: () => void
        close: () => void
        openKds: () => void
      }
      products: {
        getAll: () => Promise<Product[]>
        getCategories: () => Promise<Category[]>
        create: (data: Partial<Product>) => Promise<{ id: number }>
        update: (id: number, data: Partial<Product>) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
        getVariants: (productId: number) => Promise<Variant[]>
        getAddons: (productId: number) => Promise<AddonGroup[]>
        getCombos: () => Promise<Combo[]>
      }
      tables: {
        getAll: () => Promise<Table[]>
        update: (id: number, data: Partial<Table>) => Promise<{ success: boolean }>
        create: (data: Partial<Table>) => Promise<{ id: number }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      orders: {
        getAll: (filters?: OrderFilters) => Promise<Order[]>
        getById: (id: number) => Promise<OrderDetail | null>
        getActive: () => Promise<Order[]>
        create: (data: Partial<Order>) => Promise<{ id: number; order_number: string }>
        update: (id: number, data: Partial<Order>) => Promise<{ success: boolean }>
        addItem: (orderId: number, item: CartItem) => Promise<{ id: number }>
        removeItem: (orderItemId: number) => Promise<{ success: boolean }>
        updateItemStatus: (orderItemId: number, status: string) => Promise<{ success: boolean }>
        void: (id: number, reason: string) => Promise<{ success: boolean }>
        onUpdated: (callback: (order: Order) => void) => () => void
      }
      payments: {
        process: (data: PaymentData) => Promise<PaymentResult>
        getByOrder: (orderId: number) => Promise<Payment[]>
        applyDiscount: (data: DiscountData) => Promise<{ success: boolean }>
        validateVoucher: (code: string) => Promise<VoucherResult>
        removeDiscount: (orderId: number, type: string) => Promise<{ success: boolean; subtotal: number; discountAmount: number; total: number }>
      }
      users: {
        getAll: () => Promise<User[]>
        login: (pin: string) => Promise<LoginResult>
        create: (data: Partial<User>) => Promise<{ success: boolean; id?: number }>
        update: (id: number, data: Partial<User>) => Promise<{ success: boolean }>
        delete: (id: number) => Promise<{ success: boolean }>
      }
      reports: {
        getDailySummary: (date: string) => Promise<DailySummary>
        getSalesByItem: (from: string, to: string) => Promise<SalesByItem[]>
        getSalesByStaff: (from: string, to: string) => Promise<SalesByStaff[]>
        getHourlyTrends: (date: string) => Promise<HourlyTrend[]>
        exportCsv: (type: string, from: string, to: string) => Promise<{ success: boolean; path?: string }>
      }
      sync: {
        onStatusChange: (callback: (status: SyncStatus) => void) => () => void
        getStatus: () => Promise<SyncStatus>
      }
      shell: {
        openExternal: (url: string) => void
      }
    }
  }
}

// =============================================
// Core Types
// =============================================
export type UserRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen'
export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'grabfood' | 'foodpanda'
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'voided'
export type TableStatus = 'available' | 'occupied' | 'reserved'
export type PaymentMethod = 'cash' | 'card' | 'gcash' | 'maya' | 'grabfood' | 'foodpanda'
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'syncing'

export interface User {
  id: number
  name: string
  pin?: string
  role: UserRole
  is_active: number
  created_at: string
}

export interface Category {
  id: number
  name: string
  color: string
  icon: string
  sort_order: number
}

export interface Variant {
  id: number
  product_id: number
  name: string
  price_modifier: number
  sort_order: number
}

export interface Addon {
  id: number
  addon_group_id: number
  product_id: number
  name: string
  price: number
}

export interface AddonGroup {
  id: number
  product_id: number
  name: string
  min_select: number
  max_select: number
  is_required: number
  addons: Addon[]
}

export interface Product {
  id: number
  category_id: number
  name: string
  description?: string
  base_price: number
  image_url?: string
  is_available: number
  sort_order: number
  category_name?: string
  category_color?: string
  variants?: Variant[]
  addon_groups?: AddonGroup[]
}

export interface Combo {
  id: number
  name: string
  description?: string
  price: number
  is_available: number
  items?: { product_id: number; product_name: string; quantity: number }[]
}

export interface Table {
  id: number
  name: string
  section: string
  capacity: number
  status: TableStatus
  current_order_id?: number
  order_number?: string
  order_status?: OrderStatus
  order_total?: number
}

export interface Order {
  id: number
  order_number: string
  table_id?: number
  table_name?: string
  type: OrderType
  status: OrderStatus
  cashier_id?: number
  cashier_name?: string
  waiter_id?: number
  waiter_name?: string
  customer_name?: string
  customer_count: number
  notes?: string
  subtotal: number
  discount_amount: number
  total: number
  created_at: string
  updated_at: string
  completed_at?: string
}

export interface OrderItem {
  id: number
  order_id: number
  product_id?: number
  combo_id?: number
  variant_id?: number
  name: string
  quantity: number
  unit_price: number
  total_price: number
  notes?: string
  status: string
  addons?: { id: number; name: string; price: number }[]
}

export interface OrderDetail extends Order {
  items: OrderItem[]
  modifiers: OrderModifier[]
  payments: Payment[]
}

export interface OrderModifier {
  id: number
  order_id: number
  type: string
  label: string
  value: number
  is_percentage: number
}

export interface Payment {
  id: number
  order_id: number
  method: PaymentMethod
  amount: number
  tendered: number
  change_amount: number
  reference_no?: string
  created_at: string
}

export interface CartItem {
  product_id?: number
  combo_id?: number
  variant_id?: number
  name: string
  quantity: number
  unit_price: number
  notes?: string
  addons?: { id?: number; name: string; price: number }[]
}

export interface OrderFilters {
  status?: string
  date?: string
  type?: string
}

export interface PaymentData {
  order_id: number
  method: PaymentMethod
  amount: number
  tendered?: number
  reference_no?: string
}

export interface PaymentResult {
  id: number
  change: number
  order_number: string
}

export interface DiscountData {
  order_id: number
  type: string
  label: string
  value: number
  is_percentage: boolean
}

export interface VoucherResult {
  valid: boolean
  message?: string
  voucher?: {
    id: number
    code: string
    discount_type: string
    discount_value: number
  }
}

export interface LoginResult {
  success: boolean
  message?: string
  user?: User
}

export interface DailySummary {
  date: string
  orders: {
    total_orders: number
    gross_sales: number
    total_discounts: number
    net_sales: number
  }
  byType: { type: string; count: number; amount: number }[]
  byPaymentMethod: { method: string; count: number; amount: number }[]
  voidedOrders: { count: number }
}

export interface SalesByItem {
  name: string
  total_qty: number
  total_sales: number
}

export interface SalesByStaff {
  staff_name: string
  role: string
  total_orders: number
  total_sales: number
}

export interface HourlyTrend {
  hour: string
  order_count: number
  sales: number
}
