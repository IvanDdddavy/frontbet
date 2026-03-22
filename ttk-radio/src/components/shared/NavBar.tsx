import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useStreamStore } from '../../store/streamStore'
import { Logo } from './Logo'
import styles from './NavBar.module.css'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Плеер',
    roles: ['user', 'host', 'admin'] as const,
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
        <polygon points="6.5,5.5 11.5,8 6.5,10.5" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/host',
    label: 'Ведущий',
    roles: ['host', 'admin'] as const,
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M4 13.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 8l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="13.5" cy="10.5" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    to: '/admin',
    label: 'Администрирование',
    roles: ['admin'] as const,
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="2.5" width="13" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1.5" y="6.5" width="9" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1.5" y="10.5" width="11" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'История эфиров',
    roles: ['host', 'admin'] as const,
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 4.5v4l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export function NavBar() {
  const { user, logout } = useAuthStore()
  const { isLive } = useStreamStore()
  const navigate = useNavigate()

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles.some(r => user.roles.includes(r as any))
  )

  const initials = user.fullName
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <NavLink to="/" className={styles.logoLink}>
          <Logo size="sm" />
        </NavLink>
        <div className={styles.divider} />
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className={styles.right}>
        {isLive && (
          <div className={styles.liveBadge}>
            <span className={styles.liveDot} />
            В ЭФИРЕ
          </div>
        )}
        <span className={styles.userLogin}>{user.login}</span>
        <div className={styles.avatar}>{initials}</div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Выйти">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10.5 5L14 8l-3.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </nav>
  )
}
