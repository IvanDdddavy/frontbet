import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { passwordResetApi } from '../../api/auth'
import { Logo } from '../../components/shared/Logo'
import styles from './ForgotPasswordPage.module.css'

const PASSWORD_RE = /^[a-zA-Z0-9!@#$%^&*()\-_=+[\]{};:'",.<>/?`~\\|]+$/

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [tokenInfo, setTokenInfo] = useState<{ login: string; expiresAt: string } | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [checking, setChecking] = useState(true)

  const [pass,     setPass]     = useState('')
  const [pass2,    setPass2]    = useState('')
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  /* Validate token on mount */
  useEffect(() => {
    if (!token) {
      setTokenError('Ссылка недействительна — токен отсутствует.')
      setChecking(false)
      return
    }
    passwordResetApi.checkToken(token)
      .then(info => { setTokenInfo(info); setChecking(false) })
      .catch((err) => {
        setTokenError(err.response?.data?.detail ?? 'Ссылка недействительна или устарела.')
        setChecking(false)
      })
  }, [token])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!pass) errs.pass = 'Введите пароль'
    else if (pass.length < 6) errs.pass = 'Минимум 6 символов'
    else if (!PASSWORD_RE.test(pass)) errs.pass = 'Только латиница, цифры и символы'
    if (!pass2) errs.pass2 = 'Повторите пароль'
    else if (pass !== pass2) errs.pass2 = 'Пароли не совпадают'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      await passwordResetApi.resetPassword(token, pass)
      setDone(true)
      setTimeout(() => navigate('/auth'), 2500)
    } catch (err: any) {
      setErrors({ general: err.response?.data?.detail ?? 'Ошибка сброса пароля.' })
    } finally {
      setLoading(false)
    }
  }

  /* Loading state */
  if (checking) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.checkingState}>
            <span className={styles.spinner} style={{ borderTopColor: 'var(--ttk-red)', width: 28, height: 28 }} />
            <span>Проверка ссылки...</span>
          </div>
        </div>
      </div>
    )
  }

  /* Invalid token */
  if (tokenError) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logoWrap}><Logo size="sm" /></div>
          <div className={styles.errorState}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <circle cx="18" cy="18" r="17" stroke="var(--ttk-red)" strokeWidth="2"/>
              <path d="M12 12l12 12M24 12L12 24" stroke="var(--ttk-red)" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            <h2 className={styles.errorTitle}>Ссылка недействительна</h2>
            <p className={styles.errorText}>{tokenError}</p>
            <Link to="/forgot-password" className={styles.btnPrimary} style={{ textDecoration: 'none', textAlign: 'center' }}>
              Запросить новую ссылку
            </Link>
          </div>
          <div className={styles.backLink}><Link to="/auth">← Вернуться ко входу</Link></div>
        </div>
      </div>
    )
  }

  /* Success */
  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="#16a34a" strokeWidth="2"/>
                <path d="M9 16l5 5 9-9" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className={styles.successTitle}>Пароль изменён!</h2>
            <p className={styles.successText}>Перенаправляем на страницу входа...</p>
          </div>
        </div>
      </div>
    )
  }

  /* Form */
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}><Logo size="sm" /></div>
        <h1 className={styles.title}>Новый пароль</h1>
        <p className={styles.subtitle}>
          Аккаунт: <strong>{tokenInfo?.login}</strong>
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label}>Новый пароль</label>
            <input
              className={`${styles.input} ${errors.pass ? styles.inputError : ''}`}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoFocus
            />
            {errors.pass && <span className={styles.fieldError}>{errors.pass}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Повторите пароль</label>
            <input
              className={`${styles.input} ${errors.pass2 ? styles.inputError : ''}`}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={pass2}
              onChange={e => setPass2(e.target.value)}
            />
            {errors.pass2 && <span className={styles.fieldError}>{errors.pass2}</span>}
          </div>

          {errors.general && (
            <div className={styles.errorBox}>{errors.general}</div>
          )}

          <button type="submit" className={styles.btnPrimary} disabled={loading}>
            {loading
              ? <><span className={styles.spinner} /> Сохранение...</>
              : 'Сохранить пароль'
            }
          </button>
        </form>

        <div className={styles.backLink}><Link to="/auth">← Вернуться ко входу</Link></div>
      </div>
    </div>
  )
}
