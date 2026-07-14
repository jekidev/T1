from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from typing_extensions import TypedDict


class StateRecord(TypedDict):
    state: dict[str, object] | None
    revision: int
    updated_at: str | None


class RevisionConflictError(RuntimeError):
    pass


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with closing(self.connect()) as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS app_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    state_json TEXT NOT NULL,
                    revision INTEGER NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """
            )
            connection.commit()

    def get_state(self) -> StateRecord:
        with closing(self.connect()) as connection:
            row = connection.execute(
                "SELECT state_json, revision, updated_at FROM app_state WHERE id = 1"
            ).fetchone()
        if row is None:
            return {"state": None, "revision": 0, "updated_at": None}
        return {
            "state": json.loads(row["state_json"]),
            "revision": int(row["revision"]),
            "updated_at": str(row["updated_at"]),
        }

    def save_state(
        self,
        state: dict[str, object],
        expected_revision: int,
    ) -> StateRecord:
        now = datetime.now(timezone.utc).isoformat()
        with closing(self.connect()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT revision FROM app_state WHERE id = 1"
            ).fetchone()
            current_revision = int(row["revision"]) if row else 0
            if current_revision != expected_revision:
                connection.rollback()
                raise RevisionConflictError(
                    f"Expected revision {expected_revision}, found {current_revision}"
                )
            new_revision = current_revision + 1
            connection.execute(
                """
                INSERT INTO app_state (id, state_json, revision, updated_at)
                VALUES (1, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    state_json = excluded.state_json,
                    revision = excluded.revision,
                    updated_at = excluded.updated_at
                """,
                (json.dumps(state, ensure_ascii=False), new_revision, now),
            )
            connection.commit()
        return {"state": state, "revision": new_revision, "updated_at": now}
