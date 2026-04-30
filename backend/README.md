# OpsLens MCP - Backend Starter

Multi-agent industrial RCA system built on Anthropic's Model Context Protocol.

> *"The most responsible AI is not the one with the most confidence — it is the one that knows what it does not know."*

## What you get

- **FastAPI backend** with `/rca` (sync) and `/rca/stream` (Server-Sent Events) endpoints.
- **Local MCP server** (`mcp_server/server.py`) exposing **6 tools**:
  1. `query_sensor_data`
  2. `get_maintenance_history`
  3. `search_incident_database`
  4. `fetch_equipment_specs`
  5. `run_diagnostic_check`
  6. `get_safety_protocols`
- **Visible Safety Gateway** (`app/safety_gateway.py`) - deterministic policy layer every tool call passes through. Cannot be overridden by an LLM.
- **5 specialised agents** that debate over 2 rounds: Data, Pattern, Hypothesis, Safety Critic, Synthesis.
- **Synthetic industrial dataset** (`data/synthetic_dataset.py`) - 30 days of hourly sensor traces for 4 assets (pump, compressor, heat exchanger, motor) with embedded faults, plus maintenance history, historical incidents, and safety protocols.
- **Mock LLM mode** - the whole system runs end-to-end with **zero API keys** using deterministic rule-based reasoning. Drop in `ANTHROPIC_API_KEY` to upgrade to Claude.

## Layout

```
backend/
├── app/                    # FastAPI + orchestrator + agents + gateway
│   ├── main.py
│   ├── orchestrator.py
│   ├── agents.py
│   ├── safety_gateway.py
│   ├── mcp_client.py
│   ├── schemas.py
│   └── config.py
├── mcp_server/             # MCP server (stdio) + tool implementations
│   ├── server.py
│   └── tools.py
├── data/                   # Synthetic dataset (regenerates on first import)
│   └── synthetic_dataset.py
├── tests/smoke_test.py     # End-to-end test
├── requirements.txt
├── run.ps1 / run.sh
└── .env.example
```

## Run it (Windows / PowerShell)

```powershell
cd backend
.\run.ps1
```

That script creates a venv, installs deps, regenerates the synthetic dataset, and starts the API on `http://localhost:8000`.

### Smoke test (no server needed)

```powershell
cd backend
python -m tests.smoke_test
```

Expected output:
```
Top hypothesis (p=0.65): Outer race spalling on drive-end bearing ...
Confidence: 0.65
Tool calls executed: 8
Tool calls blocked by gateway: 0
Human review checklist:
  [critical] Lock-Out / Tag-Out (LOTO) ...
  ...
SMOKE TEST OK
```

### Hit the API

```powershell
# health + tool list
curl http://localhost:8000/health
curl http://localhost:8000/tools

# canned demo
curl http://localhost:8000/demo

# real incident (sync)
curl -X POST http://localhost:8000/rca `
  -H "Content-Type: application/json" `
  -d '{"incident_id":"INC-1","asset_id":"COMP-118","description":"discharge temp climbing, motor current high"}'

# streaming (SSE) — useful for the Next.js UI
curl -N -X POST http://localhost:8000/rca/stream `
  -H "Content-Type: application/json" `
  -d '{"incident_id":"INC-2","asset_id":"HX-307","description":"flow dropping, outlet temperature rising"}'
```

## Demoing MCP interoperability

The MCP server runs standalone, so you can also plug it into Claude Desktop:

```powershell
python -m mcp_server.server
```

Or have the FastAPI orchestrator talk to it over stdio instead of in-process:

```powershell
$env:MCP_USE_SUBPROCESS = "1"
.\run.ps1
```

## How a request flows

```
POST /rca
   │
   ▼
Orchestrator
   ├── Round 1
   │     ├── DataAgent       → SafetyGateway → MCP tools (sensors / specs / maint)
   │     ├── PatternAgent    → SafetyGateway → run_diagnostic_check, search_incident_database
   │     ├── HypothesisAgent (reasons over shared findings)
   │     └── SafetyCritic    → SafetyGateway → get_safety_protocols
   ├── Round 2 (debate)
   │     ├── HypothesisAgent revisits with full context
   │     └── SafetyCritic re-checks the proposed plan
   └── SynthesisAgent → final RCAReport with:
         • top hypothesis + alternatives + likelihoods
         • known unknowns
         • human review checklist (the engineer is the final decision-maker)
         • full transcript + every gateway-audited tool call
```

## Next steps

- Wire a Next.js UI to `/rca/stream` and render the agent transcript + gateway audit live.
- Deploy backend to Railway, frontend to Vercel.
- Replace synthetic dataset with a customer feed when piloting.
