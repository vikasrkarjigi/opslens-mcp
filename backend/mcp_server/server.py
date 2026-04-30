"""OpsLens MCP server (stdio transport).

Exposes the 6 industrial-RCA tools defined in `tools.py` via Anthropic's
Model Context Protocol so any MCP-compatible client (Claude Desktop, the
OpsLens FastAPI orchestrator, etc.) can use them.

Run directly:
    python -m mcp_server.server
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from .tools import TOOLS, call_tool

server: Server = Server("opslens-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(name=name, description=meta["description"], inputSchema=meta["schema"])
        for name, meta in TOOLS.items()
    ]


@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any] | None) -> list[TextContent]:
    result = call_tool(name, arguments or {})
    return [TextContent(type="text", text=json.dumps(result, default=str, indent=2))]


async def _main() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(_main())
