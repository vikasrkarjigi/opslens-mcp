#!/usr/bin/env bash
set -euo pipefail
python -m venv .venv
source .venv/bin/activate
pip install -q -r requirements.txt
python -m data.synthetic_dataset
uvicorn app.main:app --reload --port 8000
