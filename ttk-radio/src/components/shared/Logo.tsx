import styles from './Logo.module.css'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ size = 'md' }: Props) {
  const s = size === 'sm' ? 28 : size === 'lg' ? 52 : 38
  return (
    <div className={styles.logoWrap} style={{ '--s': `${s}px` } as React.CSSProperties}>
      <div className={styles.logoBox}>
        <span className={styles.logoText}>ТТК</span>
      </div>
      <div className={styles.logoBrand}>
        <span className={styles.brandTop}>ТРАНСТЕЛЕКОМ</span>
        <span className={styles.brandBot}>Эфирная платформа</span>
      </div>
    </div>
  )
}
