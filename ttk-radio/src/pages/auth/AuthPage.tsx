import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth'
import { Logo } from '../../components/shared/Logo'
import styles from './AuthPage.module.css'

type Tab = 'login' | 'register'

const LATIN_RE    = /^[a-zA-Z][a-zA-Z0-9_]+$/
const CYRILLIC_RE = /^[А-ЯЁа-яё\s]+$/
const PASSWORD_RE = /^[a-zA-Z0-9!@#$%^&*()\-_=+\[\]{};:'",.<>/?`~\\|]+$/

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <span className={styles.fieldError}>{msg}</span>
}

export function AuthPage() {
  const [tab, setTab] = useState<Tab>('login')
  const navigate      = useNavigate()
  const loginStore    = useAuthStore(s => s.login)

  /* ── Login ─────────────────────────────────────── */
  const [lLogin,   setLLogin]   = useState('')
  const [lPass,    setLPass]    = useState('')
  const [lError,   setLError]   = useState('')
  const [lLoading, setLLoading] = useState(false)

  /* ── Register ──────────────────────────────────── */
  const [rLogin,    setRLogin]    = useState('')
  const [rFullName, setRFullName] = useState('')
  const [rPass,     setRPass]     = useState('')
  const [rPass2,    setRPass2]    = useState('')
  const [rErrors,   setRErrors]   = useState<Record<string, string>>({})
  const [rLoading,  setRLoading]  = useState(false)
  const [rSuccess,  setRSuccess]  = useState(false)

  /* ── Handlers ──────────────────────────────────── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lLogin.trim() || !lPass.trim()) {
      setLError('Заполните все поля')
      return
    }
    setLError('')
    setLLoading(true)
    try {
      const { user, token } = await authApi.login(lLogin.trim(), lPass)
      loginStore(user, token)
      navigate('/')
    } catch (err: any) {
      setLError(err.response?.data?.detail || 'Неверный логин или пароль')
    } finally {
      setLLoading(false)
    }
  }

  const validateRegister = (): Record<string, string> => {
    const errs: Record<string, string> = {}

    if (!rLogin.trim())
      errs.login = 'Обязательное поле'
    else if (!LATIN_RE.test(rLogin.trim()))
      errs.login = 'Только латиница, цифры и _'
    else if (rLogin.trim().length < 3)
      errs.login = 'Минимум 3 символа'

    if (!rFullName.trim())
      errs.fullName = 'Обязательное поле'
    else if (!CYRILLIC_RE.test(rFullName.trim()))
      errs.fullName = 'Только русские буквы и пробел'
    else if (rFullName.trim().split(/\s+/).length < 2)
      errs.fullName = 'Введите имя и фамилию'

    if (!rPass)
      errs.pass = 'Обязательное поле'
    else if (rPass.length < 6)
      errs.pass = 'Минимум 6 символов'
    else if (!PASSWORD_RE.test(rPass))
      errs.pass = 'Только латиница, цифры и символы'

    if (!rPass2)
      errs.pass2 = 'Повторите пароль'
    else if (rPass !== rPass2)
      errs.pass2 = 'Пароли не совпадают'

    return errs
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateRegister()
    setRErrors(errs)
    if (Object.keys(errs).length > 0) return

    setRLoading(true)
    try {
      const { user, token } = await authApi.register(
        rLogin.trim(),
        rFullName.trim(),
        rPass,
      )
      // Auto-login after registration
      loginStore(user, token)
      setRSuccess(true)
      setTimeout(() => navigate('/'), 1200)
    } catch (err: any) {
      setRErrors({ general: err.response?.data?.detail || 'Ошибка регистрации' })
    } finally {
      setRLoading(false)
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setLError('')
    setRErrors({})
    setRSuccess(false)
  }

  /* ── Render ────────────────────────────────────── */
  return (
    <div className={styles.page}>

      {/* Left decorative panel */}
      <div className={styles.left}>
        <div className={styles.leftContent}>
          <Logo size="lg" />
          <p className={styles.tagline}>
            Платформа потокового вещания<br />
            для корпоративного эфира
          </p>
          <ul className={styles.features}>
            <li>
              <span className={styles.featIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                  <polygon points="6.5,5.5 11.5,8 6.5,10.5" fill="currentColor"/>
                </svg>
              </span>
              Аудио и видеотрансляции в реальном времени
            </li>
            <li>
              <span className={styles.featIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              Управление плейлистом и медиатекой
            </li>
            <li>
              <span className={styles.featIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M11 8c1.5.8 2.5 2.3 2.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="11" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              </span>
              Ролевая система: пользователь, ведущий, администратор
            </li>
            <li>
              <span className={styles.featIcon}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 3h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4l-3 2V4a1 1 0 0 1 1-1z"
                    stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                </svg>
              </span>
              Обратная связь со слушателями
            </li>
          </ul>
        </div>
      </div>

      {/* Right: auth form */}
      <div className={styles.right}>
        <div className={styles.card}>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
              onClick={() => switchTab('login')}
            >
              Вход
            </button>
            <button
              className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => switchTab('register')}
            >
              Регистрация
            </button>
          </div>

          {/* ── Login form ───────────────── */}
          {tab === 'login' && (
            <form className={`${styles.form} page-enter`} onSubmit={handleLogin} noValidate>
              <div className={styles.field}>
                <label className={styles.label}>Логин</label>
                <input
                  className={styles.input}
                  type="text"
                  autoComplete="username"
                  placeholder="username"
                  value={lLogin}
                  onChange={e => setLLogin(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Пароль</label>
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={lPass}
                  onChange={e => setLPass(e.target.value)}
                />
              </div>

              <div style={{ textAlign: 'right', marginTop: -8 }}>
                <Link
                  to="/forgot-password"
                  style={{ fontSize: 12, color: 'var(--ttk-muted)', textDecoration: 'none', fontWeight: 500 }}
                  onMouseOver={e => (e.currentTarget.style.color = 'var(--ttk-red)')}
                  onMouseOut={e => (e.currentTarget.style.color = 'var(--ttk-muted)')}
                >
                  Забыли пароль?
                </Link>
              </div>

              {lError && (
                <div className={styles.errorBox} role="alert">
                  {lError}
                </div>
              )}

              <button className={styles.btnPrimary} type="submit" disabled={lLoading}>
                {lLoading
                  ? <><span className={styles.spinner} /> Вход...</>
                  : 'Войти'
                }
              </button>


            </form>
          )}

          {/* ── Register form ─────────────── */}
          {tab === 'register' && (
            <form className={`${styles.form} page-enter`} onSubmit={handleRegister} noValidate>
              {rSuccess && (
                <div className={styles.successBox} role="status">
                  Аккаунт создан! Входим в систему…
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>
                  Логин <span className={styles.rule}>(только латиница)</span>
                </label>
                <input
                  className={`${styles.input} ${rErrors.login ? styles.inputError : ''}`}
                  type="text"
                  autoComplete="username"
                  placeholder="username"
                  value={rLogin}
                  onChange={e => setRLogin(e.target.value)}
                  autoFocus
                />
                <FieldError msg={rErrors.login} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  ФИО <span className={styles.rule}>(только кириллица)</span>
                </label>
                <input
                  className={`${styles.input} ${rErrors.fullName ? styles.inputError : ''}`}
                  type="text"
                  autoComplete="name"
                  placeholder="Иванов Иван Иванович"
                  value={rFullName}
                  onChange={e => setRFullName(e.target.value)}
                />
                <FieldError msg={rErrors.fullName} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Пароль</label>
                <input
                  className={`${styles.input} ${rErrors.pass ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={rPass}
                  onChange={e => setRPass(e.target.value)}
                />
                <FieldError msg={rErrors.pass} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Повторите пароль</label>
                <input
                  className={`${styles.input} ${rErrors.pass2 ? styles.inputError : ''}`}
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={rPass2}
                  onChange={e => setRPass2(e.target.value)}
                />
                <FieldError msg={rErrors.pass2} />
              </div>

              {rErrors.general && (
                <div className={styles.errorBox} role="alert">
                  {rErrors.general}
                </div>
              )}

              <button
                className={styles.btnPrimary}
                type="submit"
                disabled={rLoading || rSuccess}
              >
                {rLoading
                  ? <><span className={styles.spinner} /> Создание аккаунта...</>
                  : 'Зарегистрироваться'
                }
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  )
}
