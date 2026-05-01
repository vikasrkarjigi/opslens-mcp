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
    # Exact origins (local dev + the production Vercel domain).
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://opslens-mcp.vercel.app",
    ]
    # Regex to also allow every Vercel preview deployment URL
    # (e.g. https://opslens-mcp-git-feature-username.vercel.app).
    # Starlette's CORSMiddleware does not glob `allow_origins`, so we hand it
    # this pattern via `allow_origin_regex` instead.
    cors_origin_regex: str = r"https://.*\.vercel\.app"

    # Orchestrator
    max_debate_rounds: int = 2

    @property
    def use_mock_llm(self) -> bool:
        return not self.anthropic_api_key


settings = Settings()
os.environ.setdefault("OPSLENS_DATA_DIR", str(DATA_DIR))
