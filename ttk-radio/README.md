# ТТК — Эфирная платформа

Фронтенд системы управления потоковым вещанием в корпоративном стиле ТТК/РЖД.

## Стек

- **React 18** + TypeScript + Vite
- **React Router v6** — роутинг с ролевыми guard-ами
- **Zustand** — глобальное состояние (auth, stream, messages)
- **MSW (Mock Service Worker)** — мок API без бэкенда
- **CSS Modules** — изолированные стили
- **PT Sans / PT Sans Narrow** — шрифт в стиле ТТК

## Быстрый старт

```bash
npm install
npx msw init public/ --save   # генерирует mockServiceWorker.js
npm run dev
```

Открыть: http://localhost:5173

## Тестовые аккаунты

| Логин       | Пароль   | Роль                    |
|-------------|----------|-------------------------|
| admin_ttk   | password | Администратор + Польз.  |
| petrov_dj   | password | Ведущий + Польз.        |
| ivanov_a    | password | Пользователь            |

## Модули

| Путь     | Доступ              | Описание                            |
|----------|---------------------|-------------------------------------|
| /auth    | Все                 | Вход и регистрация                  |
| /        | user, host, admin   | Плеер + форма сообщения             |
| /host    | host, admin         | Эфир, плейлист, медиатека, сообщения|
| /admin   | admin               | Управление пользователями           |

## Структура

```
src/
├── api/          # axios instance
├── components/
│   └── shared/   # NavBar, Modal, Logo
├── guards/       # PrivateRoute
├── hooks/        # useWebSocket, useStream, useMediaRecorder
├── mocks/        # MSW handlers (mock API)
├── pages/
│   ├── auth/     # AuthPage
│   ├── player/   # PlayerPage
│   ├── host/     # HostPage
│   └── admin/    # AdminPage
└── store/        # authStore, streamStore, messageStore
```

## Подключение реального бэкенда

1. Удалить вызов `worker.start()` в `src/main.tsx`
2. Убрать `src/mocks/` папку
3. Настроить `baseURL` в `src/api/client.ts`
4. Реальный бэкенд должен реализовать эндпоинты из `src/mocks/handlers.ts`

## Валидация полей

- **Логин**: только латинские буквы `/^[a-zA-Z]+$/`
- **ФИО**: только кириллица и пробел `/^[А-ЯЁа-яё\s]+$/`
- **Пароль**: латиница, цифры, символы (минимум 6 символов)

## Ограничения загрузки файлов

- Аудио: MP3, WAV, OGG — до 50 МБ
- Видео: MP4, WebM — до 1000 МБ
