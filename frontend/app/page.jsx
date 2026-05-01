"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, RotateCcw, Activity, Sparkles } from "lucide-react";

import IncidentSelector from "@/components/IncidentSelector";
import SafetyBanner from "@/components/SafetyBanner";
import AgentPanel from "@/components/AgentPanel";
import MCPGateway from "@/components/MCPGateway";
import RCAReport from "@/components/RCAReport";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

import { getIncidents, getHealth, streamRCA } from "@/lib/api";
import { AGENT_ORDER } from "@/lib/agents";

export default function Page() {
  const [incidents, setIncidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [description, setDescription] = useState("");
  const [health, setHealth] = useState(null);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    getIncidents()
      .then((list) => {
        setIncidents(list);
        if (list[0]) {
          setSelected(list[0]);
          setDescription(list[0].description);
        }
      })
      .catch((e) => setError(e.message));
    getHealth().then(setHealth).catch(() => {});
  }, []);

  // Group transcript messages by agent role.
  const messagesByRole = useMemo(() => {
    const out = Object.fromEntries(AGENT_ORDER.map((r) => [r, []]));
    for (const e of events) {
      if (e.type === "agent_message") {
        const role = e.payload.role;
        if (out[role]) out[role].push(e.payload);
      }
    }
    return out;
  }, [events]);

  const agentState = useMemo(() => {
    const state = Object.fromEntries(AGENT_ORDER.map((r) => [r, "idle"]));
    let activeRole = null;
    for (const e of events) {
      if (e.type === "agent_start") {
        activeRole = e.payload.role;
        if (state[activeRole] !== "done") state[activeRole] = "thinking";
      } else if (e.type === "agent_message" && e.payload.role) {
        state[e.payload.role] = "done";
        activeRole = null;
      }
    }
    if (running && activeRole) state[activeRole] = "thinking";
    return state;
  }, [events, running]);

  const blockedCount = useMemo(
    () => events.filter((e) => e.type === "tool_blocked").length,
    [events]
  );
  const totalCalls = useMemo(
    () => events.filter((e) => e.type === "tool_call" || e.type === "tool_blocked").length,
    [events]
  );
  const safetyStatus = blockedCount > 0 ? "blocked" : running ? "active" : "idle";

  async function start() {
    if (!selected) return;
    setRunning(true);
    setEvents([]);
    setReport(null);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamRCA(
        {
          incident_id: selected.incident_id,
          asset_id: selected.asset_id,
          description,
          site: selected.site,
        },
        (evt) => {
          setEvents((prev) => [...prev, evt]);
          if (evt.type === "report_ready") setReport(evt.payload);
          if (evt.type === "error") setError(evt.payload?.message || "stream error");
        },
        controller.signal
      );
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    setEvents([]);
    setReport(null);
    setError(null);
    if (selected) setDescription(selected.description);
  }

  return (
    <div className="grid-bg min-h-screen">
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <Header health={health} />

        <main className="mt-6 grid grid-cols-12 gap-6">
          {/* Left column */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            <IncidentSelector
              incidents={incidents}
              selected={selected}
              onSelect={setSelected}
              description={description}
              onDescriptionChange={setDescription}
              disabled={running}
            />
            <div className="flex gap-2">
              <Button onClick={start} disabled={!selected || running} className="flex-1">
                {running ? (
                  <>
                    <Activity size={14} className="animate-pulse" /> Investigating…
                  </>
                ) : (
                  <>
                    <Play size={14} /> Start RCA
                  </>
                )}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={running && !report}>
                <RotateCcw size={14} /> Reset
              </Button>
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}
          </aside>

          {/* Center column - agents */}
          <section className="col-span-12 lg:col-span-6 space-y-4">
            <SafetyBanner
              status={safetyStatus}
              blocked={blockedCount}
              totalCalls={totalCalls}
              verdict={report?.safety}
            />

            <div className="grid gap-3">
              {AGENT_ORDER.map((role) => (
                <AgentPanel
                  key={role}
                  role={role}
                  state={agentState[role]}
                  messages={messagesByRole[role]}
                />
              ))}
            </div>

            {report && <RCAReport report={report} />}
          </section>

          {/* Right column - gateway */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="sticky top-6">
              <MCPGateway events={events} />
            </div>
          </aside>
        </main>

        <footer className="mt-10 text-center text-xs text-muted">
          OpsLens MCP. “The most responsible AI is not the one with the most confidence;
          it is the one that knows what it does not know.”
        </footer>
      </div>
    </div>
  );
}

function Header({ health }) {
  return (
    <header className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-3 text-white shadow-lg shadow-indigo-500/30">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">OpsLens MCP</h1>
          <p className="text-xs text-muted">
            Multi-Agent Industrial RCA · powered by Anthropic Model Context Protocol
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {health ? (
          <>
            <Badge tone={health.mock_llm ? "warn" : "ok"}>
              {health.mock_llm ? "Mock LLM" : "Claude live"}
            </Badge>
            <Badge tone="info">
              <span className="font-mono">{health.tool_count}</span> MCP tools
            </Badge>
            <Badge tone="ok">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
              backend ok
            </Badge>
          </>
        ) : (
          <Badge tone="danger">backend offline</Badge>
        )}
      </div>
    </header>
  );
}
