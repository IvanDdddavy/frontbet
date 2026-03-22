import { useState } from 'react'
import { Link } from 'react-router-dom'
import { passwordResetApi } from '../../api/auth'
import { Logo } from '../../components/shared/Logo'
import styles from './ForgotPasswordPage.module.css'

export function ForgotPasswordPage() {
  const [login,   setLogin]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim()) { setError('Введите логин'); return }
    setError('')
    setLoading(true)
    try {
      await passwordResetApi.forgot(login.trim())
      setSent(true)
    } catch {
      setError('Ошибка отправки. Попробуйте позже.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <Logo size="sm" />
        </div>

        {!sent ? (
          <>
            <h1 className={styles.title}>Восстановление пароля</h1>
            <p className={styles.subtitle}>
              Введите логин — мы отправим ссылку для сброса пароля на привязанный email.
            </p>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label className={styles.label}>Логин</label>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ''}`}
                  type="text"
                  autoComplete="username"
                  placeholder="username"
                  value={login}
                  onChange={e => { setLogin(e.target.value); setError('') }}
                  autoFocus
                />
                {error && <span className={styles.fieldError}>{error}</span>}
              </div>

              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={loading}
              >
                {loading
                  ? <><span className={styles.spinner} /> Отправка...</>
                  : 'Отправить ссылку'
                }
              </button>
            </form>
          </>
        ) : (
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="#16a34a" strokeWidth="2"/>
                <path d="M9 16l5 5 9-9" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className={styles.successTitle}>Письмо отправлено</h2>
            <p className={styles.successText}>
              Если аккаунт с логином <strong>{login}</strong> существует,
              на привязанный email придёт ссылка для сброса пароля.
            </p>
            <p className={styles.devHint}>
              В dev-режиме ссылка выводится в логи Docker:
              <code>docker compose logs backend | grep "reset"</code>
            </p>
          </div>
        )}

        <div className={styles.backLink}>
          <Link to="/auth">← Вернуться ко входу</Link>
        </div>
      </div>
    </div>
  )
}
