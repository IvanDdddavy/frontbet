import { useState, useEffect } from 'react'
import { usersApi } from '../../api/users'
import type { UserRow } from '../../api/users'
import { useAuthStore, Role } from '../../store/authStore'
import { Modal } from '../../components/shared/Modal'
import { toast } from '../../store/toastStore'
import styles from './AdminPage.module.css'


const LATIN_RE = /^[a-zA-Z]+$/
const CYRILLIC_RE = /^[А-ЯЁа-яё\s]+$/
const ALL_ROLES = ['user', 'host', 'admin'] as const
const ROLE_LABEL: Record<string, string> = { user: 'Пользователь', host: 'Ведущий', admin: 'Администратор' }
const ROLE_CLASS: Record<string, string> = { user: 'roleUser', host: 'roleHost', admin: 'roleAdmin' }

export function AdminPage() {
  const { user: me } = useAuthStore()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  /* Filters */
  const [fLogin, setFLogin] = useState('')
  const [fName, setFName] = useState('')
  const [fRole, setFRole] = useState('')
  const [fDate, setFDate] = useState('')

  /* Modals */
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [passUser, setPassUser] = useState<UserRow | null>(null)
  const [rolesUser, setRolesUser] = useState<UserRow | null>(null)

  /* Edit form */
  const [editLogin, setEditLogin] = useState('')
  const [editName, setEditName] = useState('')
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})

  /* Password form */
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [passError, setPassError] = useState('')

  /* Roles form */
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  /* Fetch */
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await usersApi.getAll()
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  /* Filter */
  const filtered = users.filter(u => {
    if (fLogin && !u.login.toLowerCase().includes(fLogin.toLowerCase())) return false
    if (fName && !u.fullName.toLowerCase().includes(fName.toLowerCase())) return false
    if (fRole && !u.roles.includes(fRole)) return false
    if (fDate && !u.createdAt.includes(fDate)) return false
    return true
  })

  /* Delete */
  const handleDelete = async (id: string) => {
    if (!confirm('Удалить пользователя?')) return
    await usersApi.softDelete(id)
    setUsers(u => u.filter(x => x.id !== id))
    toast.success('Пользователь удалён')
  }

  /* Open edit modal */
  const openEdit = (u: UserRow) => {
    setEditUser(u)
    setEditLogin(u.login)
    setEditName(u.fullName)
    setEditErrors({})
  }

  /* Submit edit */
  const handleEditSave = async () => {
    const errs: Record<string, string> = {}
    if (!LATIN_RE.test(editLogin)) errs.login = 'Только латиница'
    if (!CYRILLIC_RE.test(editName.trim())) errs.fullName = 'Только кириллица'
    setEditErrors(errs)
    if (Object.keys(errs).length > 0) return
    await usersApi.update(editUser!.id, { login: editLogin, full_name: editName.trim() })
    setUsers(u => u.map(x => x.id === editUser!.id ? { ...x, login: editLogin, fullName: editName.trim() } : x))
    toast.success('Данные пользователя обновлены')
    setEditUser(null)
  }

  /* Submit password */
  const handlePassSave = async () => {
    if (!newPass) { setPassError('Введите пароль'); return }
    if (newPass !== newPass2) { setPassError('Пароли не совпадают'); return }
    if (newPass.length < 6) { setPassError('Минимум 6 символов'); return }
    setPassError('')
    await usersApi.changePassword(passUser!.id, newPass)
    toast.success('Пароль успешно изменён')
    setPassUser(null)
    setNewPass(''); setNewPass2('')
  }

  /* Open roles modal */
  const openRoles = (u: UserRow) => {
    setRolesUser(u)
    setSelectedRoles([...u.roles])
  }

  /* Submit roles */
  const handleRolesSave = async () => {
    const updated = await usersApi.assignRoles(rolesUser!.id, selectedRoles)
    setUsers(u => u.map(x => x.id === rolesUser!.id ? updated : x))
    toast.success('Роли назначены')
    setRolesUser(null)
  }

  const toggleRole = (role: string) => {
    if (role === 'admin' || role === 'host') {
      if (!me?.roles.includes('admin' as Role)) return
    }
    setSelectedRoles(r => r.includes(role) ? r.filter(x => x !== role) : [...r, role])
  }

  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.container}>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Управление пользователями</h1>
          <span className={styles.countBadge}>{filtered.length} записей</span>
        </div>

        {/* Filters */}
        <div className={styles.filtersCard}>
          <div className={styles.filtersRow}>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Логин</label>
              <input className={styles.filterInput} placeholder="Поиск по логину" value={fLogin} onChange={e => setFLogin(e.target.value)} />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>ФИО</label>
              <input className={styles.filterInput} placeholder="Поиск по ФИО" value={fName} onChange={e => setFName(e.target.value)} />
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Роль</label>
              <select className={styles.filterInput} value={fRole} onChange={e => setFRole(e.target.value)}>
                <option value="">Все роли</option>
                {ALL_ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div className={styles.filterField}>
              <label className={styles.filterLabel}>Дата регистрации</label>
              <input className={styles.filterInput} type="date" value={fDate} onChange={e => setFDate(e.target.value)} />
            </div>
            <button className={styles.clearBtn} onClick={() => { setFLogin(''); setFName(''); setFRole(''); setFDate('') }}>
              Сбросить
            </button>
          </div>
        </div>

        {/* Table */}
        <div className={styles.tableCard}>
          {loading ? (
            <div className={styles.loadingRow}>Загрузка...</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Логин</th>
                    <th>ФИО</th>
                    <th>Роль</th>
                    <th>Дата регистрации</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className={styles.emptyCell}>Пользователи не найдены</td></tr>
                  )}
                  {filtered.map(u => (
                    <tr key={u.id}>
                      <td className={styles.loginCell}>{u.login}</td>
                      <td>{u.fullName}</td>
                      <td>
                        <div className={styles.rolesCell}>
                          {u.roles.map(r => (
                            <span key={r} className={`${styles.roleBadge} ${styles[ROLE_CLASS[r] || 'roleUser']}`}>
                              {ROLE_LABEL[r] || r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={styles.dateCell}>{u.createdAt}</td>
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} onClick={() => openEdit(u)} title="Редактировать">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button className={styles.actionBtn} onClick={() => { setPassUser(u); setNewPass(''); setNewPass2(''); setPassError('') }} title="Сменить пароль">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <rect x="4" y="7" width="8" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                          </button>
                          <button className={styles.actionBtn} onClick={() => openRoles(u)} title="Назначить роли">
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                              <path d="M2 13c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                              <path d="M11 8v4M9 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => handleDelete(u.id)}
                            title="Удалить"
                            disabled={u.id === me?.id}
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5M4 5l1 8h6l1-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editUser && (
        <Modal title="Редактировать пользователя" onClose={() => setEditUser(null)}>
          <div className={styles.modalForm}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Логин <span className={styles.rule}>(латиница)</span></label>
              <input className={`${styles.modalInput} ${editErrors.login ? styles.inputErr : ''}`}
                value={editLogin} onChange={e => setEditLogin(e.target.value)} />
              {editErrors.login && <span className={styles.fieldErr}>{editErrors.login}</span>}
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>ФИО <span className={styles.rule}>(кириллица)</span></label>
              <input className={`${styles.modalInput} ${editErrors.fullName ? styles.inputErr : ''}`}
                value={editName} onChange={e => setEditName(e.target.value)} />
              {editErrors.fullName && <span className={styles.fieldErr}>{editErrors.fullName}</span>}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setEditUser(null)}>Отмена</button>
              <button className={styles.btnPrimary} onClick={handleEditSave}>Сохранить</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Modal */}
      {passUser && (
        <Modal title={`Смена пароля — ${passUser.login}`} onClose={() => setPassUser(null)}>
          <div className={styles.modalForm}>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Новый пароль</label>
              <input className={styles.modalInput} type="password" placeholder="••••••••"
                value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Подтверждение</label>
              <input className={`${styles.modalInput} ${passError ? styles.inputErr : ''}`} type="password" placeholder="••••••••"
                value={newPass2} onChange={e => setNewPass2(e.target.value)} />
              {passError && <span className={styles.fieldErr}>{passError}</span>}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setPassUser(null)}>Отмена</button>
              <button className={styles.btnPrimary} onClick={handlePassSave}>Сохранить</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Roles Modal */}
      {rolesUser && (
        <Modal title={`Роли — ${rolesUser.login}`} onClose={() => setRolesUser(null)} width={380}>
          <div className={styles.modalForm}>
            <div className={styles.rolesGrid}>
              {ALL_ROLES.map(role => {
                const restricted = (role === 'admin' || role === 'host') && !me?.roles.includes('admin' as Role)
                return (
                  <label key={role} className={`${styles.roleOption} ${restricted ? styles.roleDisabled : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      disabled={restricted}
                    />
                    <span className={`${styles.roleBadge} ${styles[ROLE_CLASS[role]]}`}>{ROLE_LABEL[role]}</span>
                    {restricted && <span className={styles.restrictedNote}>только администратор</span>}
                  </label>
                )
              })}
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setRolesUser(null)}>Отмена</button>
              <button className={styles.btnPrimary} onClick={handleRolesSave}>Применить</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
