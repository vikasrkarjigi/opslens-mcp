"""FastAPI entry-point for OpsLens MCP."""
from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from .config import settings
from .mcp_client import build_client
from .orchestrator import Orchestrator
from .schemas import IncidentRequest, RCAReport

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_orchestrator = Orchestrator()
_client = build_client()


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "app": settings.app_name,
        "mock_llm": settings.use_mock_llm,
        "tool_count": len(_client.list_tools()),
    }


@app.get("/tools")
def list_tools() -> list[dict]:
    return _client.list_tools()


@app.get("/assets")
def list_assets() -> list[dict]:
    import json as _json

    from .config import DATA_DIR

    return _json.loads((DATA_DIR / "assets.json").read_text())


@app.get("/incidents")
def list_incidents() -> list[dict]:
    """Hand-curated demo incidents shown in the UI's incident selector."""
    import json as _json

    from .config import DATA_DIR

    return _json.loads((DATA_DIR / "demo_incidents.json").read_text())


@app.post("/rca", response_model=RCAReport)
def run_rca(req: IncidentRequest) -> RCAReport:
    try:
        return _orchestrator.run(req)
    except Exception as e:
        raise HTTPException(500, f"orchestrator failure: {e}")


@app.post("/rca/stream")
async def run_rca_stream(req: IncidentRequest):
    """Stream every agent step + tool call to the UI as Server-Sent Events."""

    async def event_gen():
        for event in _orchestrator.run_stream(req):
            yield {"event": event.type, "data": json.dumps(event.payload, default=str)}

    return EventSourceResponse(event_gen())


# convenience: a minimal demo incident so curl-style smoke tests work.
@app.get("/demo")
def demo() -> RCAReport:
    return _orchestrator.run(
        IncidentRequest(
            incident_id="DEMO-001",
            asset_id="PUMP-204",
            description="Operator reports rising vibration and bearing temperature on drive end.",
        )
    )
