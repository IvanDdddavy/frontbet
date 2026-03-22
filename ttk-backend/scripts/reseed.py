"""
Fix test user passwords in running container:
  docker compose exec backend python scripts/reseed.py
"""
import asyncio, bcrypt, uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

import sys, os
sys.path.insert(0, '/app')
os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://ttk:ttk_pass@postgres:5432/ttk_radio')

from app.core.config import get_settings
settings = get_settings()

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    pw = bcrypt.hashpw(b"password", bcrypt.gensalt(rounds=10)).decode()

    users = [
        ("admin_ttk",  "Смирнова Ольга Сергеевна",   ["admin","user"]),
        ("petrov_dj",  "Петров Дмитрий Иванович",     ["host","user"]),
        ("ivanov_a",   "Иванов Алексей Петрович",      ["user"]),
        ("sidorova_m", "Сидорова Марина Викторовна",   ["user"]),
    ]

    async with Session() as db:
        for login, full_name, roles in users:
            r = await db.execute(text("SELECT id FROM users WHERE login=:l"), {"l":login})
            row = r.fetchone()
            if row:
                await db.execute(
                    text("UPDATE users SET password_hash=:h, is_deleted=false WHERE login=:l"),
                    {"h":pw,"l":login}
                )
                print(f"✓ Updated {login}")
            else:
                uid = str(uuid.uuid4())
                await db.execute(text("""
                    INSERT INTO users(id,login,full_name,password_hash,is_deleted,created_at)
                    VALUES(:id,:l,:fn,:h,false,:ca)
                """),{"id":uid,"l":login,"fn":full_name,"h":pw,"ca":datetime.now(timezone.utc)})
                for role in roles:
                    await db.execute(text(
                        "INSERT INTO user_roles(user_id,role) VALUES(:u,:r) ON CONFLICT DO NOTHING"
                    ),{"u":uid,"r":role})
                print(f"✓ Created {login}")
        await db.commit()
    print("\nAll done — password for all users is: 'password'")

asyncio.run(main())
