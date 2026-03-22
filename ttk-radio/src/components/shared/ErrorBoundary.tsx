import React from 'react'
import styles from './ErrorBoundary.module.css'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.wrap}>
          <div className={styles.box}>
            <div className={styles.icon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#E3001B" strokeWidth="2"/>
                <path d="M16 10v8" stroke="#E3001B" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="16" cy="22" r="1.5" fill="#E3001B"/>
              </svg>
            </div>
            <h2 className={styles.title}>Что-то пошло не так</h2>
            <p className={styles.msg}>{this.state.error?.message}</p>
            <button className={styles.btn} onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
