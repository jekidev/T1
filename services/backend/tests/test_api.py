from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from personal_framework.config import Settings
from personal_framework.main import create_app


def test_auth_and_revisioned_state(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        access_token="test-access-token",
        session_secret="test-session-secret",
        data_dir=tmp_path,
        allowed_origins=("http://localhost:5173",),
        host="127.0.0.1",
        port=8000,
    )

    with TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/state").status_code == 401

        login = client.post("/api/auth/login", json={"token": "test-access-token"})
        assert login.status_code == 200

        initial = client.get("/api/state")
        assert initial.json() == {"state": None, "revision": 0, "updated_at": None}

        saved = client.put(
            "/api/state",
            json={"state": {"projects": []}, "expected_revision": 0},
        )
        assert saved.status_code == 200
        assert saved.json()["revision"] == 1

        conflict = client.put(
            "/api/state",
            json={"state": {"projects": ["stale"]}, "expected_revision": 0},
        )
        assert conflict.status_code == 409
