import { api } from './client'

export interface UserRow {
  id: string
  login: string
  fullName: string
  roles: string[]
  createdAt: string
}

export const usersApi = {
  getAll: async (): Promise<UserRow[]> => {
    const { data } = await api.get<UserRow[]>('/users')
    return data
  },

  update: async (id: string, body: { login?: string; full_name?: string }): Promise<UserRow> => {
    const { data } = await api.put<UserRow>(`/users/${id}`, body)
    return data
  },

  softDelete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },

  changePassword: async (id: string, password: string): Promise<void> => {
    await api.post(`/users/${id}/password`, { password })
  },

  assignRoles: async (id: string, roles: string[]): Promise<UserRow> => {
    const { data } = await api.post<UserRow>(`/users/${id}/roles`, { roles })
    return data
  },
}
