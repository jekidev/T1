from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    token: str = Field(min_length=8, max_length=4096)


class StateUpdate(BaseModel):
    state: dict[str, object]
    expected_revision: int = Field(ge=0)
