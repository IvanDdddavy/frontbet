import { useWebSocket } from '../../hooks/useWebSocket'
import { useAuthStore } from '../../store/authStore'
import { useStreamStore } from '../../store/streamStore'
import styles from './ListenersWidget.module.css'

export function ListenersWidget() {
  const { token } = useAuthStore()
  const { isLive } = useStreamStore()
  const { listeners, connected } = useWebSocket(token)

  if (!isLive) return null

  return (
    <div className={styles.widget} title="Слушателей онлайн">
      <span className={styles.dot} />
      <span className={styles.count}>{listeners}</span>
      <span className={styles.label}>онлайн</span>
    </div>
  )
}
