import { useAudioMixer } from '../../hooks/useAudioMixer'
import styles from './MixerPanel.module.css'

interface Props {
  onMixedStream?: (stream: MediaStream | null) => void
}

export function MixerPanel({ onMixedStream }: Props) {
  const mixer = useAudioMixer()
  const { state } = mixer

  const handleToggle = async () => {
    if (state.isActive) {
      mixer.stop()
      onMixedStream?.(null)
    } else {
      const stream = await mixer.start()
      onMixedStream?.(stream)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="4" width="2" height="8" rx="1" fill="currentColor"/>
            <rect x="6" y="2" width="2" height="12" rx="1" fill="currentColor"/>
            <rect x="10" y="5" width="2" height="7" rx="1" fill="currentColor"/>
            <rect x="14" y="3" width="2" height="10" rx="1" fill="currentColor"/>
          </svg>
          Аудио микшер
        </div>
        <button
          className={`${styles.toggleBtn} ${state.isActive ? styles.toggleOn : ''}`}
          onClick={handleToggle}
        >
          {state.isActive ? 'Выключить микшер' : 'Включить микшер'}
        </button>
      </div>

      {state.isActive && (
        <div className={styles.channels}>
          {/* Microphone channel */}
          <div className={styles.channel}>
            <div className={styles.channelHeader}>
              <span className={styles.channelLabel}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <rect x="6" y="1" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M3 8c0 2.8 2.2 5 5 5s5-2.2 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Микрофон
              </span>
              <button
                className={`${styles.muteBtn} ${state.isMicMuted ? styles.muteBtnOn : ''}`}
                onClick={mixer.toggleMic}
                title={state.isMicMuted ? 'Включить микрофон' : 'Выключить микрофон'}
              >
                {state.isMicMuted ? 'Вкл' : 'Выкл'}
              </button>
            </div>
            <div className={styles.faderRow}>
              <input
                type="range" min="0" max="100"
                value={state.micVolume}
                onChange={e => mixer.setMicVolume(Number(e.target.value))}
                className={styles.fader}
                disabled={state.isMicMuted}
              />
              <span className={styles.faderVal}>{state.micVolume}%</span>
            </div>
            <div className={styles.vuMeter}>
              <div
                className={styles.vuBar}
                style={{ width: state.isMicMuted ? '0%' : `${state.micVolume}%` }}
              />
            </div>
          </div>

          {/* Playlist channel */}
          <div className={styles.channel}>
            <div className={styles.channelHeader}>
              <span className={styles.channelLabel}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
                  <polygon points="6.5,5.5 11.5,8 6.5,10.5" fill="currentColor"/>
                </svg>
                Плейлист
              </span>
            </div>
            <div className={styles.faderRow}>
              <input
                type="range" min="0" max="100"
                value={state.playlistVolume}
                onChange={e => mixer.setPlaylistVolume(Number(e.target.value))}
                className={styles.fader}
              />
              <span className={styles.faderVal}>{state.playlistVolume}%</span>
            </div>
            <div className={styles.vuMeter}>
              <div className={styles.vuBar} style={{ width: `${state.playlistVolume}%` }} />
            </div>
          </div>
        </div>
      )}

      {!state.isActive && (
        <p className={styles.hint}>
          Микшер объединяет звук с микрофона и из плейлиста в один эфирный поток
        </p>
      )}
    </div>
  )
}
