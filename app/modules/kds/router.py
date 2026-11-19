from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.common.enums import UserRole, KitchenStation, TicketStatus, OrderStatus
from app.modules.auth.models import User
from app.modules.kds.schemas import KitchenTicketResponse, KitchenTicketUpdate
from app.modules.kds.service import KDSService

router = APIRouter(prefix="/kds", tags=["KDS Display"])

# ================= KDS Ticket Feed (Station-filtered) =================
@router.get("/tickets", response_model=List[KitchenTicketResponse])
async def view_kds_display(
    station: Optional[KitchenStation] = None,
    status_filter: Optional[TicketStatus] = Query(None, alias="status"),
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.WAITER]))
):
    service = KDSService(db)
    station_val = station.value if station else None
    status_val = status_filter.value if status_filter else None
    return await service.list_tickets(station=station_val, status=status_val, exclude_served=active_only)

@router.get("/tickets/{ticket_id}", response_model=KitchenTicketResponse)
async def get_kds_ticket(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.WAITER]))
):
    service = KDSService(db)
    return await service.get_ticket_by_id(ticket_id)

@router.put("/tickets/{ticket_id}", response_model=KitchenTicketResponse)
async def update_kds_display(
    ticket_id: int,
    data: KitchenTicketUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.WAITER]))
):
    service = KDSService(db)
    return await service.update_ticket(ticket_id, data)

@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kds_display(
    ticket_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    service = KDSService(db)
    await service.delete_ticket(ticket_id)
    return None

# ================= Canonical Semi-Automatic Chef KDS Workflow Actions =================
@router.post("/orders/{order_id}/accept")
@router.post("/orders/{order_id}/confirm")
async def kds_accept_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """
    Chef Action 1: Accept Order.
    - Validates order is PENDING.
    - Confirms order & creates Order Confirmation Voucher.
    - Automatically transitions order into PREPARING.
    - Calculates & persists preparation_due_at based on longest item prep duration.
    """
    from app.modules.order.service import OrderService
    service = OrderService(db)
    order = await service.accept_order_by_chef(order_id, chef_user_id=current_user.id)
    return {
        "message": "Order accepted and entered preparing status",
        "order_id": order.id,
        "status": order.status,
        "voucher_number": f"VCH-{order.order_number}",
        "preparing_at": order.preparing_at,
        "preparation_due_at": order.preparation_due_at,
        "preparation_duration_seconds": order.preparation_duration_seconds
    }

@router.post("/orders/{order_id}/prepare")
async def kds_prepare_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """Backward-compatible alias for preparation start."""
    from app.modules.order.service import OrderService
    service = OrderService(db)
    order = await service.accept_order_by_chef(order_id, chef_user_id=current_user.id)
    return {
        "message": "Preparation started",
        "order_id": order.id,
        "status": order.status,
        "preparation_due_at": order.preparation_due_at
    }

@router.post("/orders/{order_id}/cook")
async def kds_cook_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """Backward-compatible manual cook trigger."""
    from app.modules.order.service import OrderService
    service = OrderService(db)
    order = await service.advance_order_status(order_id, OrderStatus.COOKING.value, changed_by_user_id=current_user.id)
    return {"message": "Cooking started", "order_id": order.id, "status": order.status}

@router.post("/orders/{order_id}/ready")
async def kds_ready_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """
    Chef Action 2: Mark as Ready.
    - Validates order is eligible for ready (PREPARING or COOKING).
    - Can be clicked before preparation timer expires if food is ready early.
    - Triggers customer pickup notification.
    """
    from app.modules.order.service import OrderService
    service = OrderService(db)
    order = await service.mark_order_ready_by_chef(order_id, chef_user_id=current_user.id)
    return {
        "message": "Order marked ready for pickup",
        "order_id": order.id,
        "status": order.status,
        "ready_at": order.ready_at
    }

@router.post("/orders/{order_id}/pickup")
async def kds_pickup_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.WAITER]))
):
    """
    Customer Handover: Confirm Pickup.
    Transitions order from READY to PICKED_UP.
    """
    from app.modules.order.service import OrderService
    service = OrderService(db)
    order = await service.confirm_order_pickup(order_id, user_id=current_user.id)
    return {
        "message": "Order collected by customer",
        "order_id": order.id,
        "status": order.status,
        "picked_up_at": order.picked_up_at
    }

@router.get("/orders/ready")
async def kds_list_ready_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN, UserRole.WAITER]))
):
    """Dedicated view for Ready orders waiting for customer pickup."""
    from app.modules.order.service import OrderService
    service = OrderService(db)
    orders = await service.list_orders(status=OrderStatus.READY.value)
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "table_number": o.table_number or "Dine-In",
            "items_count": len(o.items),
            "total_amount": o.total_amount,
            "confirmed_at": o.confirmed_at,
            "status": o.status
        }
        for o in orders
    ]

# ================= Scheduler & Health Operations =================
@router.post("/scheduler/tick")
async def trigger_kds_scheduler_tick(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """Manually triggers background scheduler tick (used for maintenance / testing)."""
    from app.modules.order.service import OrderService
    service = OrderService(db)
    updated_count = await service.process_overdue_preparation_orders()
    return {"message": "Scheduler tick completed", "updated_count": updated_count}

@router.post("/orders/{order_id}/simulate-overdue")
async def simulate_order_overdue(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.KITCHEN]))
):
    """
    Simulation / maintenance endpoint:
    Sets order.preparation_due_at to 10 seconds in the past to test auto-transitioning.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import update
    from app.modules.order.models import Order
    stmt = (
        update(Order)
        .where(Order.id == order_id)
        .values(preparation_due_at=datetime.now(timezone.utc) - timedelta(seconds=10))
    )
    await db.execute(stmt)
    await db.commit()
    return {"message": "Order preparation timer set to overdue", "order_id": order_id}
