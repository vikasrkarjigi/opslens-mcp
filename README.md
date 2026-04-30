# OpsLens MCP — Multi-Agent Industrial RCA

> *"The most responsible AI is not the one with the most confidence — it is the one that knows what it does not know."*

OpsLens is a hackathon-grade industrial Root Cause Analysis platform built on Anthropic's **Model Context Protocol**. Five specialised agents debate over a synthetic fleet of industrial assets while every tool call is mediated by a deterministic, **visible Safety Gateway** the LLM cannot override.

The demo runs end-to-end without an API key — agents fall back to deterministic mock reasoning so you can show the safety story, the gateway audit trail, and the report exporter without paying for tokens.

## What's in the repo

```
.
├── backend/      FastAPI + 5 agents + MCP server (8 tools) + safety gateway + synthetic dataset
└── frontend/     Next.js 14 dashboard with live SSE streaming, gateway audit log, RCA report
```

## Architecture (1-glance)

```
            ┌─────────────────── Next.js UI ───────────────────┐
            │ Incident selector · Safety banner · Agent panels │
            │ MCP Gateway audit log · RCA report w/ checklist  │
            └──────────────────────┬───────────────────────────┘
                                   │  POST /rca/stream  (SSE)
                                   ▼
            ┌──────────────── FastAPI backend ─────────────────┐
            │  Orchestrator (2-round debate)                   │
            │   ├─ DataAgent ─────────┐                        │
            │   ├─ PatternAgent ──────┤    Visible             │
            │   ├─ HypothesisAgent ───┤  ► Safety Gateway ─►   │
            │   ├─ SafetyCritic ──────┤  (allow-list, audit)   │
            │   └─ SynthesisAgent ────┘                        │
            └──────────────────────────┬───────────────────────┘
                                       │  MCP (in-process or stdio)
                                       ▼
            ┌──────── Local MCP Server (mcp_server/) ──────────┐
            │  8 tools (7 read, 1 draft-only):                 │
            │   query_sensor_data · get_maintenance_history    │
            │   search_incident_database · fetch_equipment_specs│
            │   run_diagnostic_check · get_safety_protocols    │
            │   search_sop · generate_capa_draft (draft-only)  │
            └──────────────────────────┬───────────────────────┘
                                       ▼
            ┌──────── Synthetic industrial dataset (data/) ────┐
            │ assets · sensor_logs · maintenance · incidents   │
            │ quality_records · safety_protocols               │
            └──────────────────────────────────────────────────┘
```

## Quick start (Windows / PowerShell)

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m tests.smoke_test           # verifies end-to-end without an API key
uvicorn app.main:app --reload        # starts on http://localhost:8000
```

(Optional) Drop your Anthropic key into `backend/.env` to swap the deterministic
mock for real Claude reasoning:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key, the orchestrator runs every agent in deterministic mock mode — the
safety verdict, gateway audit trail, and report export all still work.

### 2. Frontend (new terminal)

```powershell
cd frontend
npm install
Set-Content -Path .env.local -Value "NEXT_PUBLIC_BACKEND_URL=http://localhost:8000"
npm run dev
```

The `.env.local` step makes the browser stream SSE directly from FastAPI rather
than through Next.js's rewrite proxy (which buffers and breaks streaming).

Open http://localhost:3000, pick an incident, click **Start RCA**. The agent
panels light up live, the Safety Gateway audits every tool call, and the RCA
report renders with a human-review checklist when the debate finishes. The
**Export .md** button produces a Markdown report including the full audit trail.

## The three demo scenarios

| Incident | Asset | What it shows | Verdict |
|---|---|---|---|
| **INC-1042** | PUMP-204 | Bearing wear → CAPA draft generated for human sign-off | `CAUTION_REQUIRED` |
| **INC-2031** | HX-307  | Heat-exchanger fouling, no safety blockers | `CLEAR_TO_PROCEED` |
| **INC-3005** | MTR-512 | Electrical anomaly + operator-reported "burning smell" | `DO_NOT_RESTART` |

The MTR-512 case is the centerpiece: the Safety Critic vetoes the run, CAPA
generation is suppressed, cited SOPs (`SOP-ELEC-02`) appear in the verdict
banner, and the export records every read-only tool call that produced the
conclusion.

## Why this design wins the room

- **MCP is real.** The same `mcp_server/server.py` works in Claude Desktop and inside our orchestrator over stdio.
- **Safety is visible.** The gateway is a deterministic Python policy layer, not a prompt — its decisions are rendered to the operator as they happen.
- **Agents debate.** Two rounds: specialists collect evidence, then the Hypothesis and Safety agents revisit with full context before Synthesis commits.
- **The engineer wins.** The output is not an "answer" — it is a checklist plus a list of known unknowns plus an audit trail.

## Roadmap

- Replace synthetic dataset with a customer historian feed.
- Vector-based SOP retrieval (current `search_sop` is keyword-scored).
- Fine-grained per-tenant gateway policies (allow-list + risk caps per role).
- Deploy backend → Railway, frontend → Vercel.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m tests.smoke_test
```

The smoke test runs both DEMO-001 (PUMP-204) and INC-3005 (MTR-512) end-to-end
and asserts that the electrical-anomaly scenario produces `DO_NOT_RESTART` with
CAPA suppressed. It is the regression guard for the Safety Critic logic.
