from typing import List
from fastapi import APIRouter, Depends, Response, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.common.enums import UserRole
from app.modules.auth.models import User
from app.modules.table.schemas import (
    TableCreate,
    TableUpdate,
    TableResponse,
    TableResolveResponse,
    TableRotateResponse
)
from app.modules.order.schemas import AdminAnalyticsResponse
from app.modules.table.service import TableService

router = APIRouter(tags=["Table & QR Management"])

# ================= Public Table Resolution =================
@router.get("/tables/resolve", response_model=TableResolveResponse)
async def resolve_table_qr(
    token: str = Query(..., description="Cryptographic opaque table QR token"),
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint for customers scanning a table QR code.
    Validates token existence, active status, and non-revocation.
    """
    service = TableService(db)
    return await service.resolve_table_by_token(token)

# ================= Admin Table & QR Management =================
@router.get("/admin/tables", response_model=List[TableResponse])
async def list_admin_tables(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.CASHIER, UserRole.WAITER]))
):
    """List all restaurant tables with active order counts and QR tokens."""
    service = TableService(db)
    return await service.list_tables()

@router.get("/admin/analytics", response_model=AdminAnalyticsResponse)
async def get_admin_analytics_endpoint(
    range: str = Query("7d", pattern="^(today|7d|30d)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    """
    Authoritative Business Sales & Performance Analytics.
    Restricted strictly to Administrator role.
    """
    from app.modules.order.service import OrderService
    service = OrderService(db)
    return await service.get_admin_analytics(date_range=range)

@router.post("/admin/tables", response_model=TableResponse, status_code=status.HTTP_201_CREATED)
async def create_admin_table(
    data: TableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    """Create a new table with a unique cryptographic QR token."""
    service = TableService(db)
    return await service.create_table(data)

@router.put("/admin/tables/{table_id}", response_model=TableResponse)
async def update_admin_table(
    table_id: int,
    data: TableUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    """Update table number, capacity, or active status."""
    service = TableService(db)
    return await service.update_table(table_id, data)

@router.delete("/admin/tables/{table_id}")
async def delete_admin_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    """
    Delete a restaurant table.
    Guarded against deleting tables that currently have active customer orders.
    """
    service = TableService(db)
    return await service.delete_table(table_id)

@router.post("/admin/tables/{table_id}/rotate-qr", response_model=TableRotateResponse)
async def rotate_table_qr(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    """
    Invalidates the current QR token and issues a new opaque random token.
    Previous token will immediately be rejected on customer scans.
    """
    service = TableService(db)
    return await service.rotate_qr_token(table_id)

@router.get("/admin/tables/{table_id}/card")
async def download_table_card(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.CASHIER, UserRole.WAITER]))
):
    """
    Download a complete branded Table Stand Card as high-resolution PNG,
    featuring the restaurant name, Table Number, QR code, and scan instructions.
    """
    service = TableService(db)
    table = await service.get_table_by_id(table_id)
    img_bytes = await service.generate_table_card_image(table_id)
    clean_name = table.table_number.lower().replace(" ", "_")
    filename = f"table_{clean_name}_qr_card.png"
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/admin/tables/{table_id}/qr")
async def download_table_qr(
    table_id: int,
    format: str = Query("png", pattern="^(png|svg)$", description="Image format: png or svg"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.CASHIER, UserRole.WAITER]))
):
    """Download table QR code as printable PNG or vector SVG."""
    service = TableService(db)
    img_bytes = await service.generate_qr_image(table_id, format=format)
    media_type = "image/svg+xml" if format.lower() == "svg" else "image/png"
    filename = f"table_{table_id}_qr.{format.lower()}"
    return Response(
        content=img_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
