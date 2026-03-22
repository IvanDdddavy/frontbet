import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Role = 'user' | 'host' | 'admin'

export interface User {
  id: string
  login: string
  fullName: string
  roles: Role[]
  createdAt: string
}

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
  hasRole: (role: Role) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
      hasRole: (role) => get().user?.roles.includes(role) ?? false,
    }),
    { name: 'ttk-auth' }
  )
)
