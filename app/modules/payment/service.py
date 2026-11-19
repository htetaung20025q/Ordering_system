import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.payment.models import Payment
from app.modules.payment.schemas import PaymentCreate, PaymentUpdate, CheckoutRequest, CheckoutResponse, PaymentResponse
from app.modules.order.models import Order
from app.modules.order.service import OrderService
from app.modules.order.schemas import OrderResponse
from app.common.enums import PaymentStatus, OrderStatus
from app.core.exceptions import EntityNotFoundError, PaymentFailedError, ConflictError

class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.order_service = OrderService(db)

    async def get_payment_by_id(self, payment_id: int) -> Payment:
        result = await self.db.execute(select(Payment).where(Payment.id == payment_id))
        payment = result.scalar_one_or_none()
        if not payment:
            raise EntityNotFoundError("Payment", payment_id)
        return payment

    async def list_payments(
        self,
        order_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Payment]:
        stmt = select(Payment)
        if order_id is not None:
            stmt = stmt.where(Payment.order_id == order_id)
        stmt = stmt.order_by(Payment.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_payment(self, data: PaymentCreate) -> Payment:
        order = await self.order_service.get_order_by_id(data.order_id)
        if order.status in [OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value]:
            raise ConflictError(f"Cannot process payment for order with status '{order.status}'")

        txn_ref = f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

        if data.simulate_failure:
            payment = Payment(
                order_id=order.id,
                payment_method=data.payment_method.value,
                amount=data.amount,
                status=PaymentStatus.FAILED.value,
                transaction_reference=txn_ref,
                failure_reason="Simulated payment processor rejection (insufficient funds/declined)"
            )
            self.db.add(payment)
            await self.db.commit()
            await self.db.refresh(payment)
            raise PaymentFailedError("Payment processor declined the transaction")

        payment = Payment(
            order_id=order.id,
            payment_method=data.payment_method.value,
            amount=data.amount,
            status=PaymentStatus.SUCCESSFUL.value,
            transaction_reference=txn_ref
        )
        self.db.add(payment)
        
        # Check if total paid satisfies order total
        await self.db.flush()
        all_paid = await self.db.execute(
            select(Payment).where(
                Payment.order_id == order.id,
                Payment.status == PaymentStatus.SUCCESSFUL.value
            )
        )
        total_paid = sum(p.amount for p in all_paid.scalars().all())
        if total_paid >= order.total_amount:
            order.status = OrderStatus.ACCEPTED.value

        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def process_checkout(
        self,
        data: CheckoutRequest,
        customer_id: Optional[int] = None
    ) -> CheckoutResponse:
        """
        Transactional Checkout Flow fulfilling requirements:
        1. If payment fails: Order is NOT created (rolled back completely).
        2. If payment is successful: Order is created with payment attached.
        """
        txn_ref = f"TXN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

        if data.simulate_failure:
            # Payment failed before order creation -> order is NOT created
            raise PaymentFailedError("Payment gateway declined transaction during checkout. Order was not created.")

        try:
            # Create order within transaction
            order = await self.order_service.create_order(
                data=data.order_data,
                customer_id=customer_id,
                auto_commit=False
            )

            # Record successful payment
            payment = Payment(
                order_id=order.id,
                payment_method=data.payment_method.value,
                amount=order.total_amount,
                status=PaymentStatus.SUCCESSFUL.value,
                transaction_reference=txn_ref
            )
            self.db.add(payment)
            order.status = OrderStatus.ACCEPTED.value

            await self.db.commit()
            order = await self.order_service.get_order_by_id(order.id)
            await self.db.refresh(payment)

            return CheckoutResponse(
                order=OrderResponse.model_validate(order),
                payment=PaymentResponse.model_validate(payment),
                message="Checkout and payment completed successfully. Order has been created."
            )
        except Exception:
            await self.db.rollback()
            raise

    async def update_payment(self, payment_id: int, data: PaymentUpdate) -> Payment:
        payment = await self.get_payment_by_id(payment_id)
        payment.status = data.status.value
        if data.failure_reason is not None:
            payment.failure_reason = data.failure_reason

        # Requirement: "If the payment is cancelled, the order should be cancelled."
        if data.status == PaymentStatus.CANCELLED:
            await self.order_service.cancel_order(payment.order_id)

        await self.db.commit()
        await self.db.refresh(payment)
        return payment

    async def delete_payment(self, payment_id: int) -> None:
        payment = await self.get_payment_by_id(payment_id)
        await self.db.delete(payment)
        await self.db.commit()

