import { create } from 'zustand'
import type { CartItem, OrderType } from '../types'

interface CartState {
  orderId: number | null
  orderNumber: string | null
  tableId: number | null
  orderType: OrderType
  items: CartItem[]
  subtotal: number
  discountAmount: number
  total: number
  customerName: string
  customerCount: number

  setOrder: (orderId: number, orderNumber: string) => void
  setTable: (tableId: number | null) => void
  setOrderType: (type: OrderType) => void
  setCustomer: (name: string, count: number) => void
  addItem: (item: CartItem) => void
  removeItem: (index: number) => void
  updateItemQty: (index: number, qty: number) => void
  setTotals: (subtotal: number, discountAmount: number, total: number) => void
  clearCart: () => void
}

const initialState = {
  orderId: null,
  orderNumber: null,
  tableId: null,
  orderType: 'dine_in' as OrderType,
  items: [],
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  customerName: '',
  customerCount: 1,
}

export const useCartStore = create<CartState>((set) => ({
  ...initialState,

  setOrder: (orderId, orderNumber) => set({ orderId, orderNumber }),
  setTable: (tableId) => set({ tableId }),
  setOrderType: (orderType) => set({ orderType }),
  setCustomer: (customerName, customerCount) => set({ customerName, customerCount }),

  addItem: (item) => set((state) => {
    // Check if same product+variant already in cart
    const existingIndex = state.items.findIndex(
      i => i.product_id === item.product_id && i.variant_id === item.variant_id && !item.notes
    )
    if (existingIndex >= 0 && !item.addons?.length) {
      const newItems = [...state.items]
      newItems[existingIndex] = {
        ...newItems[existingIndex],
        quantity: newItems[existingIndex].quantity + item.quantity,
      }
      return { items: newItems }
    }
    return { items: [...state.items, item] }
  }),

  removeItem: (index) => set((state) => ({
    items: state.items.filter((_, i) => i !== index),
  })),

  updateItemQty: (index, qty) => set((state) => {
    if (qty <= 0) {
      return { items: state.items.filter((_, i) => i !== index) }
    }
    const newItems = [...state.items]
    newItems[index] = { ...newItems[index], quantity: qty }
    return { items: newItems }
  }),

  setTotals: (subtotal, discountAmount, total) => set({ subtotal, discountAmount, total }),

  clearCart: () => set(initialState),
}))
