import { Navigate } from 'react-router-dom'
import { useAuthStore, Role } from '../store/authStore'

interface Props {
  children: React.ReactNode
  roles?: Role[]
}

export function PrivateRoute({ children, roles }: Props) {
  const { user } = useAuthStore()

  if (!user) return <Navigate to="/auth" replace />

  if (roles && !roles.some(r => user.roles.includes(r))) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
