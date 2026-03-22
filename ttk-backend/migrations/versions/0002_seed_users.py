"""seed default users

Revision ID: 0002
Revises: 0001
Create Date: 2025-03-20
"""
from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime, timezone

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def _bcrypt_hash(password: str) -> str:
    """Hash password using bcrypt directly (avoids passlib version issues)."""
    import bcrypt as _bcrypt
    return _bcrypt.hashpw(password.encode("utf-8"), _bcrypt.gensalt(rounds=10)).decode()


def upgrade() -> None:
    conn = op.get_bind()

    pw = _bcrypt_hash("password")

    users = [
        ("admin_ttk",  "Смирнова Ольга Сергеевна",   ["admin", "user"], "2025-01-01"),
        ("petrov_dj",  "Петров Дмитрий Иванович",     ["host",  "user"], "2025-03-03"),
        ("ivanov_a",   "Иванов Алексей Петрович",      ["user"],          "2025-01-12"),
        ("sidorova_m", "Сидорова Марина Викторовна",   ["user"],          "2025-02-20"),
    ]

    for login, full_name, roles, created_str in users:
        uid = str(uuid.uuid4())
        conn.execute(
            sa.text("""
                INSERT INTO users (id, login, full_name, password_hash, is_deleted, created_at)
                VALUES (:id, :login, :full_name, :password_hash, false, :created_at)
                ON CONFLICT (login) DO UPDATE SET password_hash = EXCLUDED.password_hash
            """),
            {
                "id":            uid,
                "login":         login,
                "full_name":     full_name,
                "password_hash": pw,
                "created_at":    datetime.fromisoformat(created_str).replace(tzinfo=timezone.utc),
            },
        )
        row = conn.execute(
            sa.text("SELECT id FROM users WHERE login = :login"),
            {"login": login},
        ).fetchone()
        actual_id = row[0]

        for role in roles:
            conn.execute(
                sa.text("""
                    INSERT INTO user_roles (user_id, role)
                    VALUES (:user_id, :role)
                    ON CONFLICT DO NOTHING
                """),
                {"user_id": actual_id, "role": role},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for login in ["admin_ttk", "petrov_dj", "ivanov_a", "sidorova_m"]:
        conn.execute(sa.text("DELETE FROM users WHERE login = :login"), {"login": login})
