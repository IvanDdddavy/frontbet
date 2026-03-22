import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status
    if (status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/auth'
      return Promise.reject(err)
    }
    if (status === 403) {
      toast.error('Нет прав доступа')
    } else if (status === 404) {
      toast.error('Ресурс не найден')
    } else if (status >= 500) {
      toast.error('Ошибка сервера. Попробуйте позже')
    } else if (!err.response) {
      toast.error('Нет соединения с сервером')
    }
    return Promise.reject(err)
  }
)
