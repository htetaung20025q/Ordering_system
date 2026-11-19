# FLOW-SYS — QR Ordering & Restaurant Management System

Production-grade **Modular Monolith Restaurant & Online Ordering System** built with **FastAPI**, **SQLAlchemy 2.0 (AsyncIO)**, and **PostgreSQL / SQLite**, paired with a modern **React 18 + TypeScript + Tailwind CSS** frontend featuring 4 dedicated role-based interfaces:

- **Customer Interface (`/customer`):** Mobile-first dining experience with table QR scanning, menu browsing, cart management, multi-round ordering, order tracking, and voucher PDF downloads.
- **Kitchen Interface (`/kitchen`):** High-readability KDS optimized for kitchen displays with independent order status workflows (New ➔ Preparing ➔ Cooking ➔ Ready).
- **Manager Interface (`/manager`):** Mobile-friendly management dashboard with full CRUD operations for categories, menu items, prices, and stock.
- **Admin Interface (`/admin`):** Traditional desktop-first web dashboard with persistent left navigation, analytics cards, revenue charts, date filters, and table QR code management.

---

## 1. Quick Start: Run Directly with One Command ⭐

You can launch both the **Backend** and **Frontend** simultaneously with a single command from the project root:

```bash
# Option A: Using the Python unified runner
python3 run.py

# Option B: Using the executable shell script
./start.sh
```

This starts:
- **FastAPI Backend:** [http://localhost:8000](http://localhost:8000) (Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs))
- **React Frontend:** [http://localhost:5173](http://localhost:5173) (Proxies API calls to `:8000`)

### Additional Run Modes:
```bash
# Unified Single-Port Production Mode (Builds SPA & serves everything on :8000)
python3 run.py --prod

# Backend Only
python3 run.py --backend

# Frontend Only
python3 run.py --frontend
```

---

## 2. Docker Deployment

### 2.1 Configuration
Copy the environment template and configure secrets:
```bash
cp .env.example .env
```

### 2.2 Launch All Services
```bash
docker compose up --build -d
```

This starts:
- **`flowsys_db`**: PostgreSQL 16 Alpine database with health checks and persistent volume storage.
- **`flowsys_backend`**: FastAPI ASGI backend on port `8000`.
- **`flowsys_frontend`**: Nginx production server on port `5173` serving the compiled React SPA with reverse proxy to the backend API.

### 2.3 Common Docker Commands
```bash
# View live logs
docker compose logs -f

# Check container status
docker compose ps

# Stop containers
docker compose down

# Stop containers and remove volumes
docker compose down -v
```

---

## 3. Pre-seeded User Accounts
| Role | Username | Password | Access Route |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `/admin` |
| **Manager** | `manager` | `manager123` | `/manager` |
| **Kitchen Chef** | `kitchen` | `kitchen123` | `/kitchen` |
| **Customer** | `customer` | `customer123` | `/customer` |

---

## 4. Clean Project Architecture

The repository is organized with a clean separation of concerns:

```text
Ordering_System/
├── app/                            # Backend Source Code (FastAPI Modular Monolith)
│   ├── main.py                     # Root FastAPI application & Lifespan handler
│   ├── core/                       # Core configuration, security, db & exceptions
│   │   ├── config.py               # Pydantic v2 SettingsConfigDict
│   │   ├── database.py             # Async SQLAlchemy Engine & SessionLocal
│   │   ├── security.py             # Native bcrypt password hashing & JWT handling
│   │   ├── dependencies.py         # Auth & RBAC dependencies
│   │   └── exceptions.py           # Custom Domain Exceptions
│   ├── common/                     # Common enums and shared schemas
│   │   └── enums.py                # UserRole, OrderType, OrderStatus, TicketStatus, etc.
│   └── modules/                    # Domain contexts
│       ├── auth/                   # User Authentication & RBAC (Login, Register, Logout)
│       ├── inventory/              # Categories, Products, Stocks, Adjustments
│       ├── order/                  # Orders, Multi-Round Ordering, Order Items
│       ├── payment/                # Payments, Checkout & Transaction Integrity
│       ├── kds/                    # Kitchen Display System & Station Routing
│       └── table/                  # Table QR Generation, Token Rotation & Card PDF Export
├── frontend/                       # Isolated Frontend Application (React 18 + TS + Tailwind)
│   ├── src/                        # Components, layouts, pages, contexts, services
│   ├── public/                     # Static icons & manifest
│   ├── index.html                  # Root HTML template
│   ├── package.json                # Frontend dependencies & build scripts
│   ├── vite.config.ts              # Vite bundler & reverse proxy config
│   ├── tailwind.config.js          # Tailwind CSS design tokens
│   ├── tsconfig.json               # TypeScript configuration
│   ├── Dockerfile                  # Multi-stage Node builder + Nginx production container
│   ├── nginx.conf                  # Nginx reverse proxy with SPA routing fallback
│   └── dist/                       # Production compiled assets
├── tests/                          # Automated Pytest Suite (21 Passing Tests)
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_inventory.py
│   ├── test_order.py
│   ├── test_payment.py
│   ├── test_kds.py
│   ├── test_concurrency_and_defenses.py
│   ├── test_qr_ordering_system.py
│   └── test_frontend.py
├── run.py                          # ⭐ Unified single-command runner (backend + frontend)
├── start.sh                        # ⭐ Executable shell launcher wrapper
├── Dockerfile.backend              # Python 3.12-slim non-root container
├── docker-compose.yml              # Multi-container orchestration (db, backend, frontend)
├── .dockerignore                   # Build exclusion rules
├── .env.example                    # Environment variable template
├── requirements.txt                # Pinned Python dependencies
└── pytest.ini                      # Pytest async configuration
```

---

## 5. Automated Testing

Run the full async test suite:
```bash
.venv/bin/pytest -v
```

All 21 automated tests verify:
- Table QR code resolution, opaque token validation, and automatic table identification.
- Customer order placement and multi-round order accumulation.
- Chef KDS workflow (Confirm ➔ Preparing ➔ Cooking ➔ Ready).
- Order confirmation vouchers with grand total integrity.
- Admin table management, QR token rotation, and printable table card PDF export.
- Admin analytics (menu popularity ranking & daily order breakdown) and manager menu CRUD boundaries.
- Atomic inventory stock depletion defenses and price-tampering immunity.
- Frontend SPA production routes and asset delivery.
