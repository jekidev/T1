from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEVELOPMENT_ACCESS_TOKEN = "dev-only-change-me"
DEVELOPMENT_SESSION_SECRET = "dev-session-secret-change-me"


def _csv(value: str) -> tuple[str, ...]:
    return tuple(item.strip().rstrip("/") for item in value.split(",") if item.strip())


@dataclass(frozen=True)
class Settings:
    environment: str
    access_token: str
    session_secret: str
    data_dir: Path
    allowed_origins: tuple[str, ...]
    host: str
    port: int

    @property
    def production(self) -> bool:
        return self.environment == "production"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "personal-framework.sqlite3"

    @property
    def web_dist(self) -> Path:
        return Path(__file__).resolve().parents[4] / "apps" / "web" / "dist"

    @classmethod
    def from_env(cls) -> Settings:
        settings = cls(
            environment=os.getenv("APP_ENV", "development").strip().lower(),
            access_token=os.getenv("APP_ACCESS_TOKEN", DEVELOPMENT_ACCESS_TOKEN),
            session_secret=os.getenv("APP_SESSION_SECRET", DEVELOPMENT_SESSION_SECRET),
            data_dir=Path(os.getenv("APP_DATA_DIR", ".personal-framework")).resolve(),
            allowed_origins=_csv(
                os.getenv(
                    "APP_ORIGINS",
                    "http://localhost:5173,http://127.0.0.1:5173",
                )
            ),
            host=os.getenv("APP_HOST", "127.0.0.1"),
            port=int(os.getenv("APP_PORT", "8000")),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if not self.access_token:
            raise RuntimeError("APP_ACCESS_TOKEN is required")
        if not self.session_secret:
            raise RuntimeError("APP_SESSION_SECRET is required")
        if self.production and self.access_token == DEVELOPMENT_ACCESS_TOKEN:
            raise RuntimeError("Production cannot use the development access token")
        if self.production and self.session_secret == DEVELOPMENT_SESSION_SECRET:
            raise RuntimeError("Production cannot use the development session secret")
