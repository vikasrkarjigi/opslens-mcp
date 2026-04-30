"""MCP client wrapper.

For the hackathon we default to an *in-process* executor that calls the
tool functions directly - this keeps the demo deterministic and avoids
any subprocess startup cost during the live show.

Flip `use_subprocess=True` (or set MCP_USE_SUBPROCESS=1) to instead spawn
the real MCP server over stdio - useful when demoing protocol-level
interoperability with Claude Desktop.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from mcp_server.tools import TOOLS, call_tool


class InProcessMCPClient:
    """Direct calls into the tool registry. Always available."""

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {"name": name, "description": meta["description"], "inputSchema": meta["schema"]}
            for name, meta in TOOLS.items()
        ]

    def call(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        return call_tool(name, arguments or {})


class StdioMCPClient:
    """Spawns the MCP server as a subprocess and talks over stdio.

    Use this to demonstrate that OpsLens really speaks the MCP wire
    protocol - Claude Desktop or any other MCP host can plug into the same
    server with zero changes.
    """

    def __init__(self) -> None:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        self._ClientSession = ClientSession
        self._params = StdioServerParameters(
            command=os.environ.get("MCP_SERVER_COMMAND", "python"),
            args=json.loads(os.environ.get("MCP_SERVER_ARGS", '["-m", "mcp_server.server"]')),
        )
        self._stdio_client = stdio_client
        self._loop = asyncio.new_event_loop()

    async def _with_session(self, fn):
        async with self._stdio_client(self._params) as (r, w):
            async with self._ClientSession(r, w) as session:
                await session.initialize()
                return await fn(session)

    def list_tools(self) -> list[dict[str, Any]]:
        async def _do(session):
            result = await session.list_tools()
            return [
                {"name": t.name, "description": t.description, "inputSchema": t.inputSchema}
                for t in result.tools
            ]

        return self._loop.run_until_complete(self._with_session(_do))

    def call(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        async def _do(session):
            result = await session.call_tool(name, arguments or {})
            text = "".join(getattr(c, "text", "") for c in result.content)
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return {"raw": text}

        return self._loop.run_until_complete(self._with_session(_do))


def build_client():
    if os.environ.get("MCP_USE_SUBPROCESS") == "1":
        return StdioMCPClient()
    return InProcessMCPClient()
