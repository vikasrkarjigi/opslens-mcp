/**
 * SSE client for POST endpoints.
 *
 * The native EventSource API only supports GET, but our /rca/stream endpoint
 * is a POST (it carries the incident payload). This helper uses fetch +
 * ReadableStream to consume Server-Sent Events from a POST request.
 */
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const path = (p) => (BACKEND ? `${BACKEND}${p}` : `/api${p}`);

export async function getAssets() {
  const r = await fetch(path("/assets"));
  if (!r.ok) throw new Error(`assets failed: ${r.status}`);
  return r.json();
}

export async function getIncidents() {
  const r = await fetch(path("/incidents"));
  if (!r.ok) throw new Error(`incidents failed: ${r.status}`);
  return r.json();
}

export async function getHealth() {
  const r = await fetch(path("/health"));
  if (!r.ok) throw new Error(`health failed: ${r.status}`);
  return r.json();
}

export async function getTools() {
  const r = await fetch(path("/tools"));
  if (!r.ok) throw new Error(`tools failed: ${r.status}`);
  return r.json();
}

/**
 * Stream an RCA investigation.
 *
 * @param {object} incident
 * @param {(evt: {type: string, payload: any}) => void} onEvent
 * @param {AbortSignal} [signal]
 */
export async function streamRCA(incident, onEvent, signal) {
  const r = await fetch(path("/rca/stream"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(incident),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`stream failed: ${r.status}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  // Find the next event boundary. The SSE spec allows LF, CRLF or CR
  // separators - sse-starlette emits CRLF, the browser EventSource ref impls
  // emit LF. Accept both so the parser is server-agnostic.
  const findBoundary = (buf) => {
    const a = buf.indexOf("\r\n\r\n");
    const b = buf.indexOf("\n\n");
    if (a === -1) return b === -1 ? [-1, 0] : [b, 2];
    if (b === -1) return [a, 4];
    return a < b ? [a, 4] : [b, 2];
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let pair;
    while (((pair = findBoundary(buffer)), pair[0] !== -1)) {
      const [idx, sepLen] = pair;
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + sepLen);
      const evt = parseSSEBlock(block);
      if (evt) onEvent(evt);
    }
  }
}

function parseSSEBlock(block) {
  let event = "message";
  let data = "";
  // Split on any of CRLF / CR / LF and trim each line.
  for (const rawLine of block.split(/\r\n|\r|\n/)) {
    const line = rawLine;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { type: event, payload: JSON.parse(data) };
  } catch {
    return { type: event, payload: { raw: data } };
  }
}
