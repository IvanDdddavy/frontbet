import { http, HttpResponse } from 'msw'

/* ── Seed data ───────────────────────────────────────── */
interface MockUser {
  id: string
  login: string
  fullName: string
  passwordPlain: string   // mock only — real backend uses bcrypt
  roles: string[]
  createdAt: string
  isDeleted: boolean
}

let users: MockUser[] = [
  { id: '1', login: 'admin_ttk',  fullName: 'Смирнова Ольга Сергеевна',   passwordPlain: 'password', roles: ['admin','user'], createdAt: '2025-01-01', isDeleted: false },
  { id: '2', login: 'petrov_dj',  fullName: 'Петров Дмитрий Иванович',    passwordPlain: 'password', roles: ['host','user'],  createdAt: '2025-03-03', isDeleted: false },
  { id: '3', login: 'ivanov_a',   fullName: 'Иванов Алексей Петрович',    passwordPlain: 'password', roles: ['user'],         createdAt: '2025-01-12', isDeleted: false },
  { id: '4', login: 'sidorova_m', fullName: 'Сидорова Марина Викторовна', passwordPlain: 'password', roles: ['user'],         createdAt: '2025-02-20', isDeleted: false },
]

interface MockMessage {
  id: string
  senderId: string
  senderLogin: string
  content: string
  voicePath: string | null
  status: string
  createdAt: string
}

let messages: MockMessage[] = [
  { id: '1', senderId: '3', senderLogin: 'ivanov_a',   content: 'Привет! Поставьте что-нибудь весёлое', voicePath: null, status: 'new',         createdAt: new Date(Date.now() - 300000).toISOString() },
  { id: '2', senderId: '4', senderLogin: 'sidorova_m', content: 'Можно поздравить именинника?',          voicePath: null, status: 'new',         createdAt: new Date(Date.now() - 120000).toISOString() },
  { id: '3', senderId: '3', senderLogin: 'ivanov_a',   content: 'Отличная трансляция, спасибо!',         voicePath: null, status: 'in_progress', createdAt: new Date(Date.now() -  60000).toISOString() },
]

let streamState = { isLive: false, isVideo: false, currentTrack: null as string | null }
let mockPlaylists: Record<string, any> = {}
let mockLibrary: any[] = []
let nextId = 100

/* ── Helpers ─────────────────────────────────────────── */
function safeUser(u: MockUser) {
  return { id: u.id, login: u.login, fullName: u.fullName, roles: u.roles, createdAt: u.createdAt }
}

function makeToken(u: MockUser) {
  return btoa(JSON.stringify({ sub: u.id, login: u.login, roles: u.roles, exp: Date.now() + 86400000 }))
}

/* ── Handlers ────────────────────────────────────────── */
export const handlers = [

  /* AUTH ───────────────────────────────────────────── */
  http.post('/api/auth/login', async ({ request }) => {
    const { login, password } = await request.json() as any
    const user = users.find(u => u.login === login && !u.isDeleted)
    if (!user || user.passwordPlain !== password)
      return HttpResponse.json({ detail: 'Неверный логин или пароль' }, { status: 401 })
    return HttpResponse.json({ user: safeUser(user), token: makeToken(user) })
  }),

  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as any
    const { login, password } = body
    const fullName = body.fullName || body.full_name || ''
    if (users.find(u => u.login === login))
      return HttpResponse.json({ detail: 'Логин уже занят' }, { status: 409 })
    const id = String(++nextId)
    const newUser: MockUser = {
      id, login, fullName, passwordPlain: password,
      roles: ['user'],
      createdAt: new Date().toISOString().split('T')[0],
      isDeleted: false,
    }
    users.push(newUser)
    return HttpResponse.json({ user: safeUser(newUser), token: makeToken(newUser) }, { status: 201 })
  }),

  /* USERS ──────────────────────────────────────────── */
  http.get('/api/users', () => {
    return HttpResponse.json(users.filter(u => !u.isDeleted).map(safeUser))
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const { id } = params as { id: string }
    const body = await request.json() as any
    users = users.map(u => {
      if (u.id !== id) return u
      return {
        ...u,
        login:    body.login    ?? u.login,
        fullName: body.full_name ?? body.fullName ?? u.fullName,
      }
    })
    const updated = users.find(u => u.id === id)!
    return HttpResponse.json(safeUser(updated))
  }),

  http.delete('/api/users/:id', ({ params }) => {
    const { id } = params as { id: string }
    users = users.map(u => u.id === id ? { ...u, isDeleted: true } : u)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/users/:id/password', async ({ params, request }) => {
    const { id } = params as { id: string }
    const { password } = await request.json() as any
    users = users.map(u => u.id === id ? { ...u, passwordPlain: password } : u)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/users/:id/roles', async ({ params, request }) => {
    const { id } = params as { id: string }
    const { roles } = await request.json() as any
    users = users.map(u => u.id === id ? { ...u, roles } : u)
    const updated = users.find(u => u.id === id)!
    return HttpResponse.json(safeUser(updated))
  }),

  /* MESSAGES ───────────────────────────────────────── */
  http.post('/api/messages', async ({ request }) => {
    const form = await request.formData()
    const content = form.get('content') as string || ''
    const sender = users.find(u => u.id === '3') || users[2]  // mock sender
    const msg: MockMessage = {
      id: String(++nextId),
      senderId: sender.id,
      senderLogin: sender.login,
      content,
      voicePath: null,
      status: 'new',
      createdAt: new Date().toISOString(),
    }
    messages.push(msg)
    return HttpResponse.json(msg, { status: 201 })
  }),

  http.get('/api/messages', ({ request }) => {
    const url = new URL(request.url)
    const includeDone = url.searchParams.get('include_done') === 'true'
    const result = includeDone ? messages : messages.filter(m => m.status !== 'done')
    return HttpResponse.json([...result].reverse())
  }),

  http.patch('/api/messages/:id/status', async ({ params, request }) => {
    const { id } = params as { id: string }
    const { status } = await request.json() as any
    messages = messages.map(m => m.id === id ? { ...m, status } : m)
    const updated = messages.find(m => m.id === id)!
    return HttpResponse.json(updated)
  }),

  /* MEDIA LIBRARY (mock — returns empty) ───────────── */
  http.get('/api/media/library', () => HttpResponse.json(mockLibrary)),

  http.post('/api/media/library', async ({ request }) => {
    const form = await request.formData()
    const file = form.get('file') as File
    const isAudio = file.type.startsWith('audio/')
    const mockId = String(++nextId)
    const mock = {
      id: mockId,
      filename: file.name,
      mediaType: isAudio ? 'audio' : 'video',
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      url: `/media/mock/${mockId}/${file.name}`,
    }
    mockLibrary.push(mock)
    return HttpResponse.json(mock, { status: 201 })
  }),

  http.delete('/api/media/library/:id', ({ params }) => {
    const { id } = params as { id: string }
    mockLibrary = mockLibrary.filter((f: any) => f.id !== id)
    return new HttpResponse(null, { status: 204 })
  }),

  /* PLAYLISTS (mock) ───────────────────────────────── */
  http.get('/api/media/playlists', () => HttpResponse.json(Object.values(mockPlaylists))),

  http.post('/api/media/playlists', async ({ request }) => {
    const { title } = await request.json() as any
    const pl = { id: String(++nextId), title: title || 'Плейлист', loopMode: false, shuffleMode: false, items: [] as any[] }
    mockPlaylists[pl.id] = pl
    return HttpResponse.json(pl, { status: 201 })
  }),

  http.put('/api/media/playlists/:id', async ({ params, request }) => {
    const { id } = params as { id: string }
    const body = await request.json() as any
    const existing = mockPlaylists[id]
    if (!existing) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    if (body.title !== undefined) existing.title = body.title
    if (body.loop_mode !== undefined) existing.loopMode = !!body.loop_mode
    if (body.shuffle_mode !== undefined) existing.shuffleMode = !!body.shuffle_mode
    if (Array.isArray(body.item_ids)) {
      existing.items = body.item_ids.map((fid: string, idx: number) => {
        const file = mockLibrary.find((f: any) => f.id === fid)
        return { id: idx + 1, position: idx, mediaFile: file || { id: fid, filename: fid, mediaType: 'audio', mimeType: 'audio/mpeg', sizeBytes: 0, uploadedAt: new Date().toISOString(), url: `/media/mock/${fid}` } }
      })
    }
    mockPlaylists[id] = existing
    return HttpResponse.json(existing)
  }),

  /* STREAM ─────────────────────────────────────────── */
  http.get('/api/stream', () => {
    return HttpResponse.json({ ...streamState, listeners: Math.floor(Math.random() * 8) + 1 })
  }),

  http.post('/api/stream', async ({ request }) => {
    const body = await request.json() as any
    if ('isLive'        in body) streamState.isLive       = body.isLive
    if ('isVideo'       in body) streamState.isVideo      = body.isVideo
    if ('currentTrack'  in body) streamState.currentTrack = body.currentTrack
    return HttpResponse.json({ ...streamState, listeners: 3 })
  }),

  /* PASSWORD RESET ────────────────────────────────────── */
  http.post('/api/auth/forgot-password', async ({ request }) => {
    const { login } = await request.json() as any
    console.log(`[MSW] Password reset requested for: ${login}`)
    console.log(`[MSW] Mock reset URL: http://localhost:5173/reset-password?token=mock-token-${Date.now()}`)
    return HttpResponse.json({ message: 'Если аккаунт существует, письмо отправлено' })
  }),

  http.get('/api/auth/reset-password/check', ({ request }) => {
    const url = new URL(request.url)
    const token = url.searchParams.get('token') || ''
    if (token.startsWith('mock-token-')) {
      return HttpResponse.json({ valid: true, login: 'test_user', expiresAt: new Date(Date.now() + 7200000).toISOString() })
    }
    return HttpResponse.json({ detail: 'Недействительная или устаревшая ссылка' }, { status: 400 })
  }),

  http.post('/api/auth/reset-password', async ({ request }) => {
    const { token } = await request.json() as any
    if (token.startsWith('mock-token-')) {
      return HttpResponse.json({ message: 'Пароль успешно изменён' })
    }
    return HttpResponse.json({ detail: 'Недействительная ссылка' }, { status: 400 })
  }),

  /* STREAM URL ─────────────────────────────────────── */
  http.get('/api/stream/url', () => {
    return HttpResponse.json({ url: '' })  // empty = mock mode, use fake progress
  }),

  /* HEALTH ─────────────────────────────────────────── */
  http.get('/api/health', () => HttpResponse.json({ status: 'ok (mock)', version: '1.0.0-mock' })),
]
