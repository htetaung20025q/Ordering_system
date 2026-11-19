import os
import asyncio
from contextlib import asynccontextmanager
from decimal import Decimal
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import hash_password, verify_password
from app.core.exceptions import DomainException
from app.modules.auth.models import User
from app.modules.inventory.models import Category, Product, Stock
from app.modules.table.models import RestaurantTable
from app.modules.table.service import generate_opaque_qr_token
from app.common.enums import UserRole, KitchenStation

# Routers
from app.modules.auth.router import router as auth_router
from app.modules.inventory.router import router as inventory_router
from app.modules.order.router import router as order_router
from app.modules.payment.router import router as payment_router
from app.modules.kds.router import router as kds_router
from app.modules.table.router import router as table_router

# Ensure all models are imported so Base.metadata knows about them
import app.modules.auth.models
import app.modules.inventory.models
import app.modules.order.models
import app.modules.payment.models
import app.modules.kds.models
import app.modules.table.models

async def seed_initial_data():
    async with AsyncSessionLocal() as session:
        # 1. Seed & Synchronize Initial Staff & User Credentials from Settings
        users_to_seed = [
            (settings.ADMIN_USERNAME, settings.ADMIN_EMAIL, settings.ADMIN_PASSWORD, settings.ADMIN_FULL_NAME, UserRole.ADMIN.value),
            (settings.MANAGER_USERNAME, settings.MANAGER_EMAIL, settings.MANAGER_PASSWORD, settings.MANAGER_FULL_NAME, UserRole.MANAGER.value),
            (settings.KITCHEN_USERNAME, settings.KITCHEN_EMAIL, settings.KITCHEN_PASSWORD, settings.KITCHEN_FULL_NAME, UserRole.KITCHEN.value),
            (settings.CUSTOMER_USERNAME, settings.CUSTOMER_EMAIL, settings.CUSTOMER_PASSWORD, settings.CUSTOMER_FULL_NAME, UserRole.CUSTOMER.value),
        ]
        for uname, uemail, upass, ufullname, urole in users_to_seed:
            res = await session.execute(select(User).where(User.username == uname))
            existing_user = res.scalar_one_or_none()
            if not existing_user:
                session.add(User(
                    username=uname,
                    email=uemail,
                    hashed_password=hash_password(upass),
                    full_name=ufullname,
                    role=urole,
                    is_active=True
                ))
            else:
                # Production sync: update password hash if .env credentials were changed
                if not verify_password(upass, existing_user.hashed_password):
                    existing_user.hashed_password = hash_password(upass)
                    existing_user.email = uemail
                    existing_user.full_name = ufullname
        await session.commit()

        # 2. Seed Categories & Products if empty
        cat_check = await session.execute(select(Category))
        if not cat_check.scalars().first():
            c_mains = Category(name="Burgers & Mains", description="Juicy burgers & chef specialties")
            c_drinks = Category(name="Drinks & Bar", description="Refreshing beverages and bar cocktails")
            c_desserts = Category(name="Desserts & Sides", description="Crispy sides & sweet desserts")
            session.add_all([c_mains, c_drinks, c_desserts])
            await session.flush()

            demo_products = [
                (c_mains.id, "Signature Truffle Burger", "Angus beef with black truffle aioli and brioche", Decimal("15000.00"), "BUR-01", KitchenStation.MAIN_KITCHEN.value, 20, 6),
                (c_mains.id, "Crispy Hot Chicken", "Golden battered spicy chicken tenders with garlic dip", Decimal("12000.00"), "CHK-01", KitchenStation.MAIN_KITCHEN.value, 25, 5),
                (c_mains.id, "Classic Cheeseburger", "Single patty with cheddar, caramelized onions, pickles", Decimal("9500.00"), "BUR-02", KitchenStation.MAIN_KITCHEN.value, 30, 5),
                (c_drinks.id, "Iced Peach Tea", "Freshly brewed Ceylon tea infused with white peach", Decimal("3500.00"), "BEV-01", KitchenStation.BAR.value, 35, 2),
                (c_drinks.id, "Craft IPA Beer", "Chilled local craft IPA with citrus aroma", Decimal("7000.00"), "BEV-02", KitchenStation.BAR.value, 20, 2),
                (c_drinks.id, "Sparkling Water", "San Pellegrino 500ml sparkling mineral water", Decimal("2500.00"), "BEV-03", KitchenStation.BAR.value, 40, 1),
                (c_desserts.id, "Golden Truffle Fries", "Crispy shoestring fries dusted with parmesan & herb salt", Decimal("5000.00"), "SID-01", KitchenStation.MAIN_KITCHEN.value, 40, 4),
                (c_desserts.id, "Molten Chocolate Lava Cake", "Warm molten center cake with vanilla bean cream", Decimal("6500.00"), "DES-01", KitchenStation.DESSERT.value, 15, 5),
            ]

            for cat_id, name, desc, price, sku, station, initial_stock, prep_mins in demo_products:
                prod = Product(
                    category_id=cat_id,
                    name=name,
                    description=desc,
                    price=price,
                    sku=sku,
                    station=station,
                    prep_time_minutes=prep_mins,
                    is_available=True
                )
                session.add(prod)
                await session.flush()
                stock = Stock(
                    product_id=prod.id,
                    current_stock=initial_stock,
                    low_stock_threshold=5
                )
                session.add(stock)

            await session.commit()

        # 3. Seed Restaurant Tables if empty
        table_check = await session.execute(select(RestaurantTable))
        if not table_check.scalars().first():
            demo_tables = [
                ("Table 01", 4),
                ("Table 02", 2),
                ("Table 03", 6),
                ("Table 04", 4),
            ]
            for t_num, cap in demo_tables:
                session.add(RestaurantTable(
                    restaurant_id=1,
                    table_number=t_num,
                    seating_capacity=cap,
                    qr_token=generate_opaque_qr_token(),
                    is_active=True
                ))
            await session.commit()

def sync_sqlite_columns(sync_conn):
    """
    Ensures existing SQLite tables have all columns defined in SQLAlchemy models.
    Prevents OperationalError: no such column when models are upgraded on SQLite.
    """
    from sqlalchemy import text
    try:
        res = sync_conn.execute(text("PRAGMA table_info(orders)"))
        existing_cols = {row[1] for row in res.fetchall()}
        
        if existing_cols:
            alter_statements = [
                ("table_id", "ALTER TABLE orders ADD COLUMN table_id INTEGER REFERENCES restaurant_tables(id) ON DELETE SET NULL"),
                ("special_instructions", "ALTER TABLE orders ADD COLUMN special_instructions TEXT"),
                ("currency", "ALTER TABLE orders ADD COLUMN currency VARCHAR(10) NOT NULL DEFAULT 'MMK'"),
                ("confirmed_at", "ALTER TABLE orders ADD COLUMN confirmed_at DATETIME"),
                ("confirmed_by", "ALTER TABLE orders ADD COLUMN confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL"),
                ("confirmed_total", "ALTER TABLE orders ADD COLUMN confirmed_total NUMERIC(12, 2)"),
                ("preparing_at", "ALTER TABLE orders ADD COLUMN preparing_at DATETIME"),
                ("preparation_duration_seconds", "ALTER TABLE orders ADD COLUMN preparation_duration_seconds INTEGER DEFAULT 300"),
                ("preparation_due_at", "ALTER TABLE orders ADD COLUMN preparation_due_at DATETIME"),
                ("cooking_at", "ALTER TABLE orders ADD COLUMN cooking_at DATETIME"),
                ("ready_at", "ALTER TABLE orders ADD COLUMN ready_at DATETIME"),
                ("picked_up_at", "ALTER TABLE orders ADD COLUMN picked_up_at DATETIME"),
            ]
            for col_name, sql in alter_statements:
                if col_name not in existing_cols:
                    sync_conn.execute(text(sql))
            sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_table_id ON orders (table_id)"))
            sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_preparation_due_at ON orders (preparation_due_at)"))

        # Check order_items columns
        item_res = sync_conn.execute(text("PRAGMA table_info(order_items)"))
        existing_item_cols = {row[1] for row in item_res.fetchall()}
        if existing_item_cols:
            if "special_instructions" not in existing_item_cols:
                sync_conn.execute(text("ALTER TABLE order_items ADD COLUMN special_instructions TEXT"))
            if "prep_time_minutes" not in existing_item_cols:
                sync_conn.execute(text("ALTER TABLE order_items ADD COLUMN prep_time_minutes INTEGER NOT NULL DEFAULT 5"))

        # Check products columns
        prod_res = sync_conn.execute(text("PRAGMA table_info(products)"))
        existing_prod_cols = {row[1] for row in prod_res.fetchall()}
        if existing_prod_cols and "prep_time_minutes" not in existing_prod_cols:
            sync_conn.execute(text("ALTER TABLE products ADD COLUMN prep_time_minutes INTEGER NOT NULL DEFAULT 5"))

        # Check order_status_history columns
        hist_res = sync_conn.execute(text("PRAGMA table_info(order_status_history)"))
        existing_hist_cols = {row[1] for row in hist_res.fetchall()}
        if existing_hist_cols:
            if "is_system" not in existing_hist_cols:
                sync_conn.execute(text("ALTER TABLE order_status_history ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0"))
            if "actor_type" not in existing_hist_cols:
                sync_conn.execute(text("ALTER TABLE order_status_history ADD COLUMN actor_type VARCHAR(20) NOT NULL DEFAULT 'user'"))
            if "notes" not in existing_hist_cols:
                sync_conn.execute(text("ALTER TABLE order_status_history ADD COLUMN notes TEXT"))
    except Exception as exc:
        print(f"[Schema Sync] Notice: {exc}")

async def run_order_preparation_scheduler():
    """
    Background worker that continuously monitors in-flight orders in PREPARING status.
    When preparation_due_at is reached, it atomically transitions the order to COOKING.
    Recovers overdue orders immediately upon backend startup.
    """
    from app.modules.order.service import OrderService
    while True:
        try:
            async with AsyncSessionLocal() as session:
                service = OrderService(session)
                await service.process_overdue_preparation_orders()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Prep Scheduler Worker Error] {e}")
        await asyncio.sleep(1.0)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if "sqlite" in str(settings.DATABASE_URL):
            await conn.run_sync(sync_sqlite_columns)
    # Seed initial test data
    await seed_initial_data()
    # Start semi-automatic kitchen background scheduler
    scheduler_task = asyncio.create_task(run_order_preparation_scheduler())
    yield
    # Graceful shutdown of background worker
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    # Cleanup resources on shutdown
    await engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-grade Modular Monolith Restaurant & Online Ordering System Backend",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Domain Exception Handler
@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Include Modular Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(inventory_router, prefix=settings.API_V1_STR)
app.include_router(order_router, prefix=settings.API_V1_STR)
app.include_router(payment_router, prefix=settings.API_V1_STR)
app.include_router(kds_router, prefix=settings.API_V1_STR)
app.include_router(table_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "system": "FLOW-SYS Backend",
        "version": settings.VERSION
    }

# Serve Frontend Static & SPA Files
BASE_DIR = os.path.dirname(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
FRONTEND_DIST_DIR = os.path.join(FRONTEND_DIR, "dist")
LEGACY_DIST_DIR = os.path.join(BASE_DIR, "dist")

# Find effective dist directory
EFFECTIVE_DIST_DIR = FRONTEND_DIST_DIR if os.path.exists(FRONTEND_DIST_DIR) else (
    LEGACY_DIST_DIR if os.path.exists(LEGACY_DIST_DIR) else None
)

# Mount Vite compiled assets
if EFFECTIVE_DIST_DIR and os.path.exists(os.path.join(EFFECTIVE_DIST_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(EFFECTIVE_DIST_DIR, "assets")), name="assets")

def get_frontend_index():
    candidates = [
        os.path.join(FRONTEND_DIST_DIR, "index.html"),
        os.path.join(LEGACY_DIST_DIR, "index.html"),
        os.path.join(FRONTEND_DIR, "index.html"),
        os.path.join(BASE_DIR, "index.html"),
    ]
    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None

@app.get("/", include_in_schema=False)
async def serve_index():
    index_file = get_frontend_index()
    if index_file:
        return FileResponse(index_file)
    return {"message": "FLOW-SYS API is running. Visit /docs for Swagger documentation."}

@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa_catch_all(full_path: str):
    # Pass through API, health, docs, and mounted asset paths
    if full_path.startswith(("api/", "health", "docs", "redoc", "openapi.json", "assets/")):
        raise HTTPException(status_code=404, detail="Not Found")

    index_file = get_frontend_index()
    if index_file:
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")
