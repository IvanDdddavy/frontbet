# ТТК Эфирная платформа

Система управления потоковым вещанием для ТрансТелеКом.
Хакатон 2026 — Кейс №1.

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | CSS Modules, PT Sans (стиль ТТК/РЖД) |
| State | Zustand |
| Mock API | MSW (Mock Service Worker) |
| Backend | Python 3.12, FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 async + Alembic |
| Database | PostgreSQL 16 |
| Cache / PubSub | Redis 7 |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| WebSocket | FastAPI + Redis pub/sub |
| Аудиостриминг | Icecast2 + Liquidsoap |
| Микшер | Web Audio API |
| Proxy | Nginx 1.27 |
| Container | Docker + Docker Compose |

## Быстрый запуск (Docker Compose)

```bash
# 1. Скопировать env
cp ttk-backend/.env.example ttk-backend/.env

# 2. Собрать и запустить
docker compose up --build

# Первый запуск: ~3-5 минут (сборка образов)
```

После запуска:
- **Приложение**: http://localhost:80
- **Аудиопоток**: http://localhost:80/stream (через nginx → Icecast)
- **Icecast admin**: http://localhost:8080 (admin / ttk_admin_pass)
- **API Docs**: http://localhost:8000/docs
- **Liquidsoap** автоматически воспроизводит файлы из `/media/playlist.m3u`

## Тестовые аккаунты

| Логин | Пароль | Роли |
|-------|--------|------|
| admin_ttk | password | Администратор + Пользователь |
| petrov_dj | password | Ведущий + Пользователь |
| ivanov_a | password | Пользователь |
| sidorova_m | password | Пользователь |

## Добавление музыки в эфир

1. Войти как `petrov_dj`
2. Раздел ведущего → Медиатека → Загрузить (MP3/WAV/OGG)
3. Нажать **«+»** рядом с файлом → файл добавится в плейлист
4. Нажать **«Включить эфир»**
5. Liquidsoap автоматически начнёт воспроизведение через Icecast

## Локальная разработка (без Docker)

### Backend
```bash
cd ttk-backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Запустить PostgreSQL и Redis:
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=ttk -e POSTGRES_PASSWORD=ttk_pass -e POSTGRES_DB=ttk_radio \
  postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend (с моками, без бэкенда)
```bash
cd ttk-radio
npm install
npx msw init public/ --save
npm run dev  # http://localhost:5173
```

### Frontend (с реальным бэкендом)
```bash
# В .env (или env var):
VITE_USE_MOCKS=false
VITE_WS_URL=ws://localhost:8000/ws
VITE_STREAM_URL=http://localhost:8080/stream
npm run dev
```

## Модули

| Путь | Доступ | Описание |
|------|--------|----------|
| /auth | Все | Вход и регистрация |
| / | user, host, admin | Плеер + сообщение ведущему |
| /host | host, admin | Эфир, плейлист, медиатека, микшер |
| /admin | admin | Управление пользователями |
| /history | host, admin | История эфиров |

## Ключевые функции

### Авторизация
- Логин, регистрация с валидацией (латиница / кириллица)
- bcrypt хеширование, JWT токены, автологин после регистрации

### Плеер (слушатель)
- Аудио / видео плеер с подключением к Icecast-потоку
- Автопереключение в режим видео при вебкам-эфире
- Текстовые и голосовые сообщения ведущему (MediaRecorder API)
- Счётчик слушателей онлайн (WebSocket)

### Раздел ведущего
- Включение / выключение эфира
- Медиатека: загрузка MP3/WAV/OGG (до 50 МБ), MP4/WebM (до 1 ГБ)
- Плейлист с loop и shuffle, автосинхронизация с Liquidsoap
- Запись с микрофона → в медиатеку
- **Web Audio API микшер**: микрофон + плейлист в одном потоке
- Вебкам-эфир (getUserMedia → WebSocket broadcast)
- Сообщения: статусы новый → в работе → завершено → архив

### Администрирование
- Таблица пользователей с фильтрами
- Редактировать, мягко удалить, сменить пароль, назначить роли
- Мультивыбор ролей, только admin назначает host/admin

### Бонус (п.12 ТЗ)
- История эфиров со статистикой (длительность, пик слушателей)
- Live-бейдж в навбаре
- Индикатор здоровья потока
