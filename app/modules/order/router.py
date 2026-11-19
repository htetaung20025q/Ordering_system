from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_optional, require_roles
from app.common.enums import UserRole, OrderStatus
from app.modules.auth.models import User
from app.modules.order.schemas import (
    OrderCreate,
    OrderUpdate,
    OrderResponse,
    AddRoundRequest,
    OrderVoucherResponse,
    OrderVoucherItemDetail
)
from app.modules.order.service import OrderService

router = APIRouter(prefix="/orders", tags=["Order Management"])

def map_order_response(order) -> OrderResponse:
    has_voucher = bool(order.voucher)
    voucher_number = order.voucher.voucher_number if order.voucher else None
    voucher_data = None
    if order.voucher:
        total_val = order.confirmed_total if order.confirmed_total is not None else order.total_amount
        total_str = f"{int(total_val):,} {order.currency or 'MMK'}"
        items_detail = [
            OrderVoucherItemDetail(
                item_name=item.item_name,
                quantity=item.quantity,
                unit_price=f"{int(item.unit_price):,} {order.currency or 'MMK'}",
                subtotal=f"{int(item.subtotal):,} {order.currency or 'MMK'}"
            )
            for item in order.items
        ]
        voucher_data = OrderVoucherResponse(
            order_id=order.id,
            voucher_number=order.voucher.voucher_number,
            voucher_code=order.voucher.voucher_number,
            order_number=order.order_number,
            restaurant_name="FLOW-SYS Gourmet Dining",
            table_number=order.table_number or "Dine-In",
            order_status="Confirmed",
            confirmed_at=order.confirmed_at or order.voucher.created_at,
            items=items_detail,
            items_snapshot=items_detail,
            subtotal=total_str,
            tax="0 MMK",
            service_charge="0 MMK",
            discount="0 MMK",
            total_amount=total_str,
            currency=order.currency or "MMK",
            notice="Total amount only. This voucher confirms food preparation and is not a payment receipt."
        )
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        customer_id=order.customer_id,
        table_id=order.table_id,
        order_type=order.order_type,
        status=order.status,
        table_number=order.table_number,
        delivery_address=order.delivery_address,
        special_instructions=order.special_instructions,
        total_amount=order.total_amount,
        currency=order.currency or "MMK",
        current_round=order.current_round,
        confirmed_at=order.confirmed_at,
        confirmed_by=order.confirmed_by,
        confirmed_total=order.confirmed_total,
        preparing_at=order.preparing_at,
        preparation_duration_seconds=order.preparation_duration_seconds,
        preparation_due_at=order.preparation_due_at,
        cooking_at=order.cooking_at,
        ready_at=order.ready_at,
        picked_up_at=order.picked_up_at,
        has_voucher=has_voucher,
        voucher_number=voucher_number,
        voucher=voucher_data,
        items=[
            {
                "id": i.id,
                "product_id": i.product_id,
                "item_name": i.item_name,
                "unit_price": i.unit_price,
                "quantity": i.quantity,
                "subtotal": i.subtotal,
                "round_number": i.round_number,
                "station": i.station,
                "special_instructions": i.special_instructions,
                "prep_time_minutes": getattr(i, "prep_time_minutes", 5) or 5
            }
            for i in order.items
        ],
        status_history=[
            {
                "id": h.id,
                "order_id": h.order_id,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "changed_by": h.changed_by,
                "is_system": getattr(h, "is_system", False) or False,
                "actor_type": getattr(h, "actor_type", "user") or "user",
                "notes": getattr(h, "notes", None),
                "changed_timestamp": h.changed_timestamp
            }
            for h in (order.status_history or [])
        ],
        created_at=order.created_at,
        updated_at=order.updated_at
    )

@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    service = OrderService(db)
    user_id = current_user.id if current_user else None
    order = await service.create_order(data, customer_id=user_id, auto_commit=True)
    return map_order_response(order)

@router.post("/{order_id}/rounds", response_model=OrderResponse)
async def add_order_round(
    order_id: int,
    data: AddRoundRequest,
    db: AsyncSession = Depends(get_db)
):
    service = OrderService(db)
    order = await service.add_round(order_id, data)
    return map_order_response(order)

@router.get("", response_model=List[OrderResponse])
async def list_orders(
    status_filter: Optional[OrderStatus] = Query(None, alias="status"),
    table_id: Optional[int] = Query(None, description="Filter orders by specific table"),
    customer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    service = OrderService(db)
    target_customer = customer_id
    if current_user and current_user.role == UserRole.CUSTOMER.value:
        target_customer = current_user.id
    status_val = status_filter.value if status_filter else None
    orders = await service.list_orders(
        customer_id=target_customer,
        table_id=table_id,
        status=status_val,
        skip=skip,
        limit=limit
    )
    return [map_order_response(o) for o in orders]

@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = OrderService(db)
    order = await service.get_order_by_id(order_id)
    return map_order_response(order)

@router.get("/{order_id}/voucher", response_model=OrderVoucherResponse)
async def get_order_voucher(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the digital Order Confirmation Voucher.
    Strictly displays Total Amount Only (no payment method, no paid/unpaid status).
    """
    service = OrderService(db)
    return await service.get_voucher_data(order_id)

@router.get("/{order_id}/voucher/pdf")
async def download_order_voucher_pdf(
    order_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Streams a print-friendly A4 PDF of the Order Confirmation Voucher.
    Total Amount Only.
    """
    service = OrderService(db)
    pdf_bytes = await service.generate_voucher_pdf(order_id)
    filename = f"Voucher_Order_{order_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: int,
    data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]))
):
    service = OrderService(db)
    order = await service.update_order(order_id, data)
    return map_order_response(order)

@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    service = OrderService(db)
    order = await service.cancel_order(order_id)
    return map_order_response(order)
