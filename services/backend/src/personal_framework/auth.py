from __future__ import annotations

import hashlib
import hmac
from collections.abc import Callable

from fastapi import Cookie, Header, HTTPException, status

from personal_framework.config import Settings

SESSION_COOKIE = "personal_framework_session"


def session_value(settings: Settings) -> str:
    return hmac.new(
        settings.session_secret.encode(),
        b"personal-framework-owner",
        hashlib.sha256,
    ).hexdigest()


def authenticated(
    settings: Settings,
    cookie: str | None,
    authorization: str | None,
) -> bool:
    if cookie and hmac.compare_digest(cookie, session_value(settings)):
        return True
    if authorization and authorization.startswith("Bearer "):
        supplied = authorization.removeprefix("Bearer ").strip()
        return hmac.compare_digest(supplied, settings.access_token)
    return False


def auth_dependency(settings: Settings) -> Callable[..., None]:
    def require_auth(
        personal_framework_session: str | None = Cookie(default=None),
        authorization: str | None = Header(default=None),
    ) -> None:
        if not authenticated(settings, personal_framework_session, authorization):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

    return require_auth
