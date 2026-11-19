#!/usr/bin/env python3
"""
FLOW-SYS — Unified Single-File Process Runner
Runs both Backend (FastAPI on :8000) and Frontend (Vite React on :5173) directly in one command.

Usage:
    python3 run.py              # Development mode (concurrent backend + frontend with hot reload)
    python3 run.py --prod       # Production mode (builds frontend & serves both on single port 8000)
    python3 run.py --backend    # Backend only
    python3 run.py --frontend   # Frontend only
"""

import sys
import os
import signal
import subprocess
import threading
import time
import argparse
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"
VENV_PYTHON = ROOT_DIR / ".venv" / "bin" / "python3"
PYTHON_BIN = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

# ANSI Color Codes
CYAN = "\033[96m"
GREEN = "\033[92m"
BLUE = "\033[94m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

processes = []

def stream_logs(pipe, prefix, color):
    """Streams stdout/stderr with distinct colored prefixes."""
    try:
        for line in iter(pipe.readline, ""):
            if not line:
                break
            clean_line = line.rstrip()
            if clean_line:
                print(f"{color}{BOLD}[{prefix}]{RESET} {clean_line}", flush=True)
    except (ValueError, IOError):
        pass

def print_banner(is_prod=False):
    print(f"\n{BOLD}{CYAN}{'=' * 66}{RESET}")
    print(f"{BOLD}{CYAN}  FLOW-SYS — RESTAURANT ORDERING & MANAGEMENT SYSTEM{RESET}")
    print(f"{BOLD}{CYAN}{'=' * 66}{RESET}")
    if is_prod:
        print(f"  {BOLD}Mode:{RESET}             {YELLOW}Unified Single-Port Production{RESET}")
        print(f"  {BOLD}Unified App:{RESET}      {GREEN}http://localhost:8000{RESET}")
        print(f"  {BOLD}Swagger Docs:{RESET}     {BLUE}http://localhost:8000/docs{RESET}")
    else:
        print(f"  {BOLD}Mode:{RESET}             {YELLOW}Full-Stack Development (Concurrent){RESET}")
        print(f"  {BOLD}Frontend UI:{RESET}      {GREEN}http://localhost:5173{RESET}")
        print(f"  {BOLD}Backend API:{RESET}      {BLUE}http://localhost:8000{RESET}")
        print(f"  {BOLD}API Swagger Docs:{RESET} {BLUE}http://localhost:8000/docs{RESET}")
    print(f"  {BOLD}Role Portals:{RESET}")
    base_url = "http://localhost:8000" if is_prod else "http://localhost:5173"
    print(f"    • Customer:     {base_url}/customer")
    print(f"    • Kitchen KDS:  {base_url}/kitchen")
    print(f"    • Manager:      {base_url}/manager")
    print(f"    • Admin:        {base_url}/admin")
    print(f"{BOLD}{CYAN}{'=' * 66}{RESET}")
    print(f"  {YELLOW}Press Ctrl+C to gracefully stop all services.{RESET}\n", flush=True)

def cleanup(signum=None, frame=None):
    """Gracefully terminates all child processes."""
    print(f"\n{YELLOW}{BOLD}Shutting down FLOW-SYS services gracefully...{RESET}", flush=True)
    for p in processes:
        if p.poll() is None:
            try:
                # Terminate entire process group
                if os.name == 'posix':
                    os.killpg(os.getpgid(p.pid), signal.SIGTERM)
                else:
                    p.terminate()
            except Exception:
                pass
    time.sleep(0.5)
    for p in processes:
        if p.poll() is None:
            try:
                if os.name == 'posix':
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                else:
                    p.kill()
            except Exception:
                pass
    print(f"{GREEN}All services stopped cleanly. Goodbye!{RESET}\n", flush=True)
    sys.exit(0)

def run_production():
    """Builds frontend and serves both API and SPA from FastAPI on port 8000."""
    print(f"{CYAN}{BOLD}Building frontend production bundle...{RESET}", flush=True)
    build_cmd = ["npm", "run", "build"]
    ret = subprocess.run(build_cmd, cwd=str(FRONTEND_DIR))
    if ret.returncode != 0:
        print(f"{RED}Frontend build failed with exit code {ret.returncode}{RESET}")
        sys.exit(ret.returncode)

    print_banner(is_prod=True)
    backend_cmd = [PYTHON_BIN, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
    proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        preexec_fn=os.setsid if os.name == 'posix' else None
    )
    processes.append(proc)
    stream_logs(proc.stdout, "APP", BLUE)
    proc.wait()

def run_development(run_backend=True, run_frontend=True):
    """Runs backend and frontend development servers concurrently with hot reload."""
    print_banner(is_prod=False)

    threads = []

    # 1. Start Backend Server
    if run_backend:
        backend_cmd = [
            PYTHON_BIN, "-m", "uvicorn", "app.main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=str(ROOT_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            preexec_fn=os.setsid if os.name == 'posix' else None
        )
        processes.append(backend_proc)
        t_be = threading.Thread(
            target=stream_logs,
            args=(backend_proc.stdout, "BACKEND", BLUE),
            daemon=True
        )
        t_be.start()
        threads.append(t_be)

    # 2. Start Frontend Server
    if run_frontend:
        # Check node_modules
        if not (FRONTEND_DIR / "node_modules").exists():
            print(f"{YELLOW}node_modules not found in frontend/. Installing dependencies...{RESET}")
            subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True)

        frontend_cmd = ["npm", "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=str(FRONTEND_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            preexec_fn=os.setsid if os.name == 'posix' else None
        )
        processes.append(frontend_proc)
        t_fe = threading.Thread(
            target=stream_logs,
            args=(frontend_proc.stdout, "FRONTEND", GREEN),
            daemon=True
        )
        t_fe.start()
        threads.append(t_fe)

    # Monitor processes
    try:
        while True:
            for p in processes:
                exit_code = p.poll()
                if exit_code is not None:
                    print(f"{RED}A service exited with code {exit_code}. Terminating runner...{RESET}")
                    cleanup()
            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup()

def main():
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    parser = argparse.ArgumentParser(description="FLOW-SYS Unified Process Runner")
    parser.add_argument("--prod", action="store_true", help="Build frontend and run single-port production server on :8000")
    parser.add_argument("--backend", action="store_true", help="Run backend only")
    parser.add_argument("--frontend", action="store_true", help="Run frontend only")

    args = parser.parse_args()

    if args.prod:
        run_production()
    elif args.backend:
        run_development(run_backend=True, run_frontend=False)
    elif args.frontend:
        run_development(run_backend=False, run_frontend=True)
    else:
        run_development(run_backend=True, run_frontend=True)

if __name__ == "__main__":
    main()
