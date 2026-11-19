from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.common.enums import PaymentMethod, PaymentStatus
from app.modules.order.schemas import OrderCreate, OrderResponse

class PaymentCreate(BaseModel):
    order_id: int
    payment_method: PaymentMethod = PaymentMethod.CARD
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    simulate_failure: bool = False

class CheckoutRequest(BaseModel):
    order_data: OrderCreate
    payment_method: PaymentMethod = PaymentMethod.CARD
    simulate_failure: bool = False

class PaymentUpdate(BaseModel):
    status: PaymentStatus
    failure_reason: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    order_id: int
    payment_method: str
    amount: Decimal
    status: str
    transaction_reference: str
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CheckoutResponse(BaseModel):
    order: Optional[OrderResponse] = None
    payment: PaymentResponse
    message: str
