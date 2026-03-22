# ТТК Эфирная платформа — Backend

FastAPI + PostgreSQL + Redis + WebSocket

## Стек

| Компонент     | Технология                        |
|---------------|-----------------------------------|
| Framework     | FastAPI 0.115                     |
| ORM           | SQLAlchemy 2.0 (async)            |
| Migrations    | Alembic                           |
| Database      | PostgreSQL 16 (asyncpg driver)    |
| Cache / PubSub | Redis 7                          |
| Auth          | JWT (python-jose) + bcrypt (passlib) |
| Files         | aiofiles, StaticFiles             |
| WebSocket     | FastAPI native + Redis pub/sub    |

## Структура

```
app/
├── api/
│   ├── v1/
│   │   ├── auth.py       POST /api/auth/login, /api/auth/register
│   │   ├── users.py      GET/PUT/DELETE /api/users, roles, password
│   │   ├── media.py      GET/POST /api/media/library, playlists
│   │   ├── messages.py   POST/GET/PATCH /api/messages
│   │   └── stream.py     GET/POST /api/stream
│   └── websocket.py      WS /ws
├── core/
│   ├── config.py         pydantic-settings (.env)
│   ├── database.py       async engine + session
│   ├── security.py       JWT + bcrypt
│   └── dependencies.py   get_current_user, require_roles
├── models/               SQLAlchemy ORM models
├── schemas/              Pydantic request/response schemas
├── services/             Business logic (auth, users, media, messages)
├── ws/
│   ├── manager.py        WebSocket connection manager + Redis pub/sub
│   └── stream_state.py   Stream state stored in Redis
└── main.py               FastAPI app + lifespan
```

## Быстрый старт (локально)

```bash
# 1. Создать .env из шаблона
cp .env.example .env

# 2. Запустить PostgreSQL + Redis (через docker или локально)
docker run -d -p 5432:5432 -e POSTGRES_USER=ttk -e POSTGRES_PASSWORD=ttk_pass -e POSTGRES_DB=ttk_radio postgres:16-alpine
docker run -d -p 6379:6379 redis:7-alpine

# 3. Создать виртуальное окружение
python -m venv venv && source venv/bin/activate

# 4. Установить зависимости
pip install -r requirements.txt

# 5. Применить миграции (создадут таблицы + сидовых пользователей)
alembic upgrade head

# 6. Запустить сервер
uvicorn app.main:app --reload --port 8000
```

Документация: http://localhost:8000/docs

## Запуск всего стека через Docker Compose

```bash
# Из корня проекта (где лежит docker-compose.yml)
docker compose up --build

# Frontend: http://localhost:80
# Backend API: http://localhost:8000
# Swagger: http://localhost:8000/docs
```

## API Endpoints

### Auth
| Method | Path                  | Auth     | Описание              |
|--------|-----------------------|----------|-----------------------|
| POST   | /api/auth/register    | —        | Регистрация           |
| POST   | /api/auth/login       | —        | Вход, получить токен  |

### Users (admin only)
| Method | Path                        | Описание               |
|--------|-----------------------------|------------------------|
| GET    | /api/users                  | Список пользователей   |
| PUT    | /api/users/{id}             | Редактировать          |
| DELETE | /api/users/{id}             | Мягкое удаление        |
| POST   | /api/users/{id}/password    | Сменить пароль         |
| POST   | /api/users/{id}/roles       | Назначить роли         |

### Media (host/admin)
| Method | Path                          | Описание               |
|--------|-------------------------------|------------------------|
| GET    | /api/media/library            | Список файлов          |
| POST   | /api/media/library            | Загрузить файл         |
| DELETE | /api/media/library/{id}       | Удалить файл           |
| GET    | /api/media/playlists          | Плейлисты              |
| POST   | /api/media/playlists          | Создать плейлист       |
| PUT    | /api/media/playlists/{id}     | Обновить плейлист      |

### Messages
| Method | Path                          | Auth         | Описание               |
|--------|-------------------------------|--------------|------------------------|
| POST   | /api/messages                 | user+        | Отправить сообщение    |
| GET    | /api/messages                 | host/admin   | Список сообщений       |
| PATCH  | /api/messages/{id}/status     | host/admin   | Сменить статус         |

### Stream
| Method | Path         | Auth       | Описание                    |
|--------|--------------|------------|-----------------------------|
| GET    | /api/stream  | user+      | Текущее состояние эфира     |
| POST   | /api/stream  | host/admin | Обновить состояние эфира    |

### WebSocket
```
ws://host/ws?token=<JWT>
```

**Сервер → клиент:**
```json
{ "type": "stream_state", "isLive": true, "isVideo": false, "track": "...", "listeners": 5 }
{ "type": "new_message", "id": "...", "senderLogin": "user1", "content": "..." }
{ "type": "message_status", "id": "...", "status": "in_progress" }
{ "type": "listeners_update", "count": 7 }
```

**Клиент (ведущий) → сервер:**
```json
{ "type": "stream_state_change", "isLive": true, "isVideo": false }
{ "type": "ping" }
```

## Тестовые аккаунты (после `alembic upgrade head`)

| Логин       | Пароль   | Роли                   |
|-------------|----------|------------------------|
| admin_ttk   | password | admin, user            |
| petrov_dj   | password | host, user             |
| ivanov_a    | password | user                   |
| sidorova_m  | password | user                   |
