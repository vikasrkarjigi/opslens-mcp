"""Application configuration loaded from environment variables / .env file."""
from __future__ import annotations

import os
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "OpsLens MCP"
    environment: str = Field(default="dev")

    # Anthropic
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # MCP
    mcp_server_command: str = "python"
    mcp_server_args: list[str] = ["-m", "mcp_server.server"]

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Orchestrator
    max_debate_rounds: int = 2

    @property
    def use_mock_llm(self) -> bool:
        return not self.anthropic_api_key


settings = Settings()
os.environ.setdefault("OPSLENS_DATA_DIR", str(DATA_DIR))
