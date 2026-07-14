from __future__ import annotations

import hmac
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from personal_framework.auth import SESSION_COOKIE, auth_dependency, session_value
from personal_framework.config import Settings
from personal_framework.database import Database, RevisionConflictError, StateRecord
from personal_framework.models import LoginRequest, StateUpdate


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_env()
    database = Database(resolved_settings.database_path)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        database.initialize()
        yield

    app = FastAPI(
        title="Personal Framework API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.settings = resolved_settings
    app.state.database = database
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(resolved_settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Authorization"],
    )
    require_auth = auth_dependency(resolved_settings)

    @app.get("/api/health")
    def health() -> dict[str, object]:
        return {
            "ok": True,
            "service": "Personal Framework API",
            "version": "0.1.0",
        }

    @app.post("/api/auth/login")
    def login(payload: LoginRequest, response: Response) -> dict[str, bool]:
        if not hmac.compare_digest(payload.token, resolved_settings.access_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid access token",
            )
        response.set_cookie(
            SESSION_COOKIE,
            session_value(resolved_settings),
            httponly=True,
            secure=resolved_settings.production,
            samesite="strict",
            max_age=60 * 60 * 24 * 30,
        )
        return {"authenticated": True}

    @app.post("/api/auth/logout")
    def logout(response: Response) -> dict[str, bool]:
        response.delete_cookie(SESSION_COOKIE)
        return {"authenticated": False}

    @app.get("/api/auth/status")
    def auth_status(_auth: None = Depends(require_auth)) -> dict[str, bool]:
        return {"authenticated": True}

    @app.get("/api/state")
    def get_state(_auth: None = Depends(require_auth)) -> StateRecord:
        return database.get_state()

    @app.put("/api/state")
    def put_state(
        payload: StateUpdate,
        _auth: None = Depends(require_auth),
    ) -> StateRecord:
        try:
            return database.save_state(payload.state, payload.expected_revision)
        except RevisionConflictError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    if resolved_settings.web_dist.exists():
        assets = resolved_settings.web_dist / "assets"
        if assets.exists():
            app.mount("/assets", StaticFiles(directory=assets), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def web_app(path: str) -> FileResponse:
            requested = resolved_settings.web_dist / path
            if path and requested.is_file():
                return FileResponse(requested)
            return FileResponse(resolved_settings.web_dist / "index.html")

    return app


app = create_app()


def run() -> None:
    settings = Settings.from_env()
    uvicorn.run(
        "personal_framework.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )
