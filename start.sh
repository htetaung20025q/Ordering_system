#!/usr/bin/env bash
# ==============================================================================
# FLOW-SYS Single-File Direct Runner Wrapper
# ==============================================================================
set -e

# Change directory to project root
cd "$(dirname "$0")"

# Activate virtual environment if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Execute unified Python runner
python3 run.py "$@"
