import { create } from 'zustand'
import type { User, SyncStatus } from '../types'

interface SessionState {
  user: User | null
  syncStatus: SyncStatus
  restaurantName: string
  setUser: (user: User | null) => void
  setSyncStatus: (status: SyncStatus) => void
  setRestaurantName: (name: string) => void
  logout: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  syncStatus: 'offline',
  restaurantName: 'My Restaurant',
  setUser: (user) => set({ user }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setRestaurantName: (restaurantName) => set({ restaurantName }),
  logout: () => set({ user: null }),
}))
