"""OLAF Backend — FastAPI entry point.

Combines ADK's built-in agent endpoints with custom OLAF API routes.
Initialises Firebase Admin SDK and mounts all route handlers.
"""

import logging
import os

import firebase_admin
import uvicorn
from dotenv import load_dotenv
from firebase_admin import credentials

load_dotenv()

from config import settings

# ── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Firebase Admin SDK init ─────────────────────────────────────────────────


def _init_firebase() -> None:
    """Initialise Firebase Admin SDK.

    Uses Application Default Credentials on Cloud Run,
    or explicit credentials from env vars for local dev.
    """
    if firebase_admin._apps:
        return  # Already initialised

    if settings.google_application_credentials:
        cred = credentials.Certificate(settings.google_application_credentials)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialised with service account file")
    elif settings.firebase_admin_private_key:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": settings.firebase_admin_project_id.strip(),
                "client_email": settings.firebase_admin_client_email.strip(),
                "private_key": settings.firebase_admin_private_key.strip().replace("\\n", "\n"),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin initialised with env var credentials")
    else:
        # Application Default Credentials (Cloud Run)
        firebase_admin.initialize_app()
        logger.info("Firebase Admin initialised with ADC")


_init_firebase()

# ── App creation ────────────────────────────────────────────────────────────

AGENT_DIR = os.path.dirname(os.path.abspath(__file__))


def create_app():
    """Create the FastAPI application with ADK and custom routes."""
    from google.adk.cli.fast_api import get_fast_api_app

    app = get_fast_api_app(
        agents_dir=AGENT_DIR,
        session_service_uri=settings.session_db_uri,
        allow_origins=settings.origins_list,
        web=settings.enable_dev_ui,
    )

    # ── Custom OLAF API routes ─────────────────────────────────────────
    from api.routes import (
        alerts,
        auth,
        companion,
        companion_stream,
        conversations,
        gemini_token,
        health,
        navigator,
        notifications,
        storyteller,
    )

    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(gemini_token.router, prefix="/api/gemini", tags=["gemini"])
    app.include_router(companion.router, prefix="/api/companion", tags=["companion"])
    app.include_router(companion_stream.router, prefix="/api/companion", tags=["companion"])
    app.include_router(conversations.router, prefix="/api/companion", tags=["companion"])
    app.include_router(storyteller.router, prefix="/api/storyteller", tags=["storyteller"])
    app.include_router(navigator.router, prefix="/api/navigator", tags=["navigator"])
    app.include_router(health.router, prefix="/api/health", tags=["health"])
    app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
    app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

    # ── Static files for locally-stored illustrations (dev fallback) ────
    import pathlib
    from fastapi.staticfiles import StaticFiles
    static_dir = pathlib.Path(AGENT_DIR) / "static" / "images"
    static_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/static/images", StaticFiles(directory=str(static_dir)), name="static-images")

    # ── Health check ────────────────────────────────────────────────────
    @app.get("/health")
    async def health_check():
        return {"status": "healthy"}

    logger.info("OLAF backend started with %d custom route groups", 10)
    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
