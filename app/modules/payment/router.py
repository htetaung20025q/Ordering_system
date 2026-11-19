from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_optional, require_roles
from app.common.enums import UserRole
from app.modules.auth.models import User
from app.modules.payment.schemas import (
    PaymentCreate,
    PaymentUpdate,
    PaymentResponse,
    CheckoutRequest,
    CheckoutResponse
)
from app.modules.payment.service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payment Management"])

@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    data: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Atomic checkout endpoint:
    - If payment succeeds -> Order is created and confirmed.
    - If payment fails -> Order is NOT created.
    """
    service = PaymentService(db)
    user_id = current_user.id if current_user else None
    return await service.process_checkout(data, customer_id=user_id)

@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    service = PaymentService(db)
    return await service.create_payment(data)

@router.get("", response_model=List[PaymentResponse])
async def list_payments(
    order_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]))
):
    service = PaymentService(db)
    return await service.list_payments(order_id=order_id, skip=skip, limit=limit)

@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]))
):
    service = PaymentService(db)
    return await service.get_payment_by_id(payment_id)

@router.put("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER]))
):
    """
    Update payment:
    If payment status is set to CANCELLED, the linked order is automatically cancelled.
    """
    service = PaymentService(db)
    return await service.update_payment(payment_id, data)

@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment(
    payment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = PaymentService(db)
    await service.delete_payment(payment_id)
    return None

