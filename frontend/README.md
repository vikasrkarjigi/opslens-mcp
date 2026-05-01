# OpsLens MCP: Frontend

Next.js 14 dashboard for the OpsLens MCP multi-agent RCA backend.

## What it shows

- **Incident selector**: pick one of the 4 synthetic assets and edit the operator description.
- **Safety banner**: live state of the deterministic Safety Gateway (idle / active / blocked).
- **5 agent panels**: Data, Pattern, Hypothesis, Safety Critic, Synthesis. Each shows live transcript, tool calls used, and a per-agent confidence bar.
- **MCP Gateway audit log**: every tool call shown with `agent → gateway decision → tool → duration`. Blocked calls highlight the gateway's rejection reason inline.
- **RCA Report**: top hypothesis with likelihood, alternatives, **known unknowns**, and a check-listable **human review** section (severity-tagged) that makes the engineer the final decision-maker.

## Run it

```powershell
cd "e:\Windsurf OpsLens MCP\frontend"
npm install
copy .env.local.example .env.local   # optional - default backend is http://localhost:8000
npm run dev
```

Open http://localhost:3000 with the backend already running at port 8000 (`backend/run.ps1`).

## Wiring

- All API calls go through `lib/api.js`. By default they hit `NEXT_PUBLIC_BACKEND_URL` directly; if that variable is empty, requests go to `/api/*` and are proxied by `next.config.js` to `http://localhost:8000`.
- Streaming uses `fetch` + `ReadableStream` (the native `EventSource` doesn't support POST, and our `/rca/stream` is a POST that carries the incident payload).

## Deploy

- Set `NEXT_PUBLIC_BACKEND_URL` to your Railway / Fly / Render backend URL.
- `npm run build && npm start`, or deploy to Vercel (no extra config needed).
