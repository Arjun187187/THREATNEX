"""Application configuration using Pydantic Settings v2."""
from functools import lru_cache
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "ThreatNex"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "threatnex-super-secret-development-key-change-in-production-min32chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "threatnex-auth"
    JWT_AUDIENCE: str = "threatnex-soc"

    # Trusted reverse proxy IPs (for X-Forwarded-For resolution)
    TRUSTED_PROXIES: List[str] = ["127.0.0.1", "::1"]

    # Cookie Security
    COOKIE_SECURE: bool = False  # Set True in production (HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./threatnex.db"

    # Redis (shared state across workers)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CONNECT_TIMEOUT: float = 2.0
    REDIS_SOCKET_TIMEOUT: float = 2.0

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        # In production, strictly reject default development placeholders and weak keys
        env = info.data.get("ENVIRONMENT", "development")
        if env == "production":
            if "development" in v or "secret-key" in v or len(v) < 32:
                raise ValueError("Insecure SECRET_KEY detected! Production requires a strong, random, non-default secret of at least 32 characters.")
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
