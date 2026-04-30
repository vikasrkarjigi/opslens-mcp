# OpsLens MCP - Run on Windows (PowerShell)
# Usage:  .\run.ps1
$ErrorActionPreference = "Stop"
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt
python -m data.synthetic_dataset
uvicorn app.main:app --reload --port 8000
