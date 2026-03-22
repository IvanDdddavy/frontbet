from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ttk:ttk_pass@localhost:5432/ttk_radio"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24h

    # Media storage
    MEDIA_DIR: str = "./media"
    MAX_AUDIO_MB: int = 50
    MAX_VIDEO_MB: int = 1000

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:80"

    # Email (SMTP)
    SMTP_HOST:     str  = "smtp.gmail.com"
    SMTP_PORT:     int  = 587
    SMTP_USER:     str  = ""
    SMTP_PASSWORD: str  = ""
    SMTP_FROM:     str  = "noreply@ttk.ru"
    SMTP_FROM_NAME: str = "ТТК Эфирная платформа"
    FRONTEND_URL:  str  = "http://localhost:80"

    # Icecast / streaming
    STREAM_URL: str = "http://localhost:8080/stream"
    PUBLIC_STREAM_URL: str = "/stream"  # URL served to browser (via nginx proxy)
    ICECAST_HOST: str = "localhost"
    ICECAST_PORT: int = 8080
    ICECAST_SOURCE_PASSWORD: str = "ttk_source_pass"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
