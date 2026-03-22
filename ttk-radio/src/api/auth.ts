import { api } from './client'
import type { User } from '../store/authStore'

export interface AuthResponse {
  user: User
  token: string
}

export const authApi = {
  login: async (login: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/login', { login, password })
    return data
  },

  register: async (login: string, fullName: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>('/auth/register', { login, fullName, full_name: fullName, password })
    return data
  },
}

export const passwordResetApi = {
  forgot: async (login: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/forgot-password', { login })
    return data
  },

  checkToken: async (token: string): Promise<{ valid: boolean; login: string; expiresAt: string }> => {
    const { data } = await api.get('/auth/reset-password/check', { params: { token } })
    return data
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/reset-password', { token, password })
    return data
  },
}
