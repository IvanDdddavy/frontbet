import { useHistoryStore } from '../../store/historyStore'
import styles from './HistoryPage.module.css'

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}ч ${m}м`
  if (m > 0) return `${m}м ${s}с`
  return `${s}с`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function HistoryPage() {
  const { records } = useHistoryStore()

  const totalBroadcasts = records.length
  const totalDuration   = records.reduce((a, r) => a + r.durationSec, 0)
  const totalMessages   = records.reduce((a, r) => a + r.messagesCount, 0)
  const peakAll         = records.reduce((a, r) => Math.max(a, r.peakListeners), 0)

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>История эфиров</h1>
          <p className={styles.pageSubtitle}>Статистика всех проведённых трансляций</p>
        </div>

        {/* Summary stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalBroadcasts}</span>
            <span className={styles.statLabel}>Всего эфиров</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{fmtDuration(totalDuration)}</span>
            <span className={styles.statLabel}>Суммарное время</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{peakAll}</span>
            <span className={styles.statLabel}>Макс. слушателей</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalMessages}</span>
            <span className={styles.statLabel}>Сообщений обработано</span>
          </div>
        </div>

        {/* History table */}
        <div className={styles.tableCard}>
          {records.length === 0 ? (
            <div className={styles.empty}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="var(--ttk-border)" strokeWidth="2"/>
                <path d="M20 12v10l5 5" stroke="var(--ttk-border)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>История эфиров пока пуста</span>
              <span className={styles.emptyHint}>Записи появятся после первого эфира</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Начало</th>
                  <th>Конец</th>
                  <th>Длительность</th>
                  <th>Пик слушателей</th>
                  <th>Сообщений</th>
                  <th>Формат</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.startedAt)}</td>
                    <td>{r.endedAt ? fmtDate(r.endedAt) : <span className={styles.liveBadge}><span className={styles.liveDot}/>Идёт сейчас</span>}</td>
                    <td>{r.durationSec > 0 ? fmtDuration(r.durationSec) : '—'}</td>
                    <td>
                      <span className={styles.peak}>{r.peakListeners}</span>
                    </td>
                    <td>{r.messagesCount}</td>
                    <td>
                      <span className={`${styles.formatBadge} ${r.wasVideo ? styles.video : styles.audio}`}>
                        {r.wasVideo ? '▶ Видео' : '♪ Аудио'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
