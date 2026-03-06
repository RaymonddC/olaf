"""OLAF Backend — Configuration via environment variables."""

from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Google AI / Vertex AI
    google_api_key: str = ""
    google_cloud_project: str = ""
    google_cloud_location: str = "us-central1"
    google_genai_use_vertexai: bool = False

    # Firebase Admin
    firebase_admin_project_id: str = ""
    firebase_admin_client_email: str = ""
    firebase_admin_private_key: str = ""
    google_application_credentials: Optional[str] = None

    # Cloud Storage
    gcs_artifacts_bucket: str = "olaf-artifacts"

    # Application
    port: int = 8080
    allowed_origins: str = "http://localhost:3000"
    log_level: str = "info"

    # Session DB
    session_db_uri: str = "sqlite+aiosqlite:///./sessions.db"

    # Dev UI
    enable_dev_ui: bool = False

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
