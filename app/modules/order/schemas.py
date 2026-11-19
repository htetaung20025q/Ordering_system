from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from app.common.enums import OrderType, OrderStatus

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    special_instructions: Optional[str] = None

class OrderCreate(BaseModel):
    order_type: OrderType = OrderType.DINE_IN
    table_number: Optional[str] = None
    qr_token: Optional[str] = Field(None, description="Optional table QR token for automatic table binding")
    delivery_address: Optional[str] = None
    special_instructions: Optional[str] = None
    items: List[OrderItemCreate] = Field(..., min_length=1)

class AddRoundRequest(BaseModel):
    items: List[OrderItemCreate] = Field(..., min_length=1)

class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    table_number: Optional[str] = None
    delivery_address: Optional[str] = None
    special_instructions: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    item_name: str
    unit_price: Decimal
    quantity: int
    subtotal: Decimal
    round_number: int
    station: str
    special_instructions: Optional[str] = None
    prep_time_minutes: int = 5

    model_config = ConfigDict(from_attributes=True)

class OrderStatusHistoryResponse(BaseModel):
    id: int
    order_id: int
    previous_status: Optional[str]
    new_status: str
    changed_by: Optional[int]
    is_system: bool = False
    actor_type: str = "user"
    notes: Optional[str] = None
    changed_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class OrderVoucherItemDetail(BaseModel):
    item_name: str
    quantity: int
    unit_price: str
    subtotal: str

class OrderVoucherResponse(BaseModel):
    order_id: Optional[int] = None
    voucher_number: str
    voucher_code: Optional[str] = None
    order_number: str
    restaurant_name: str
    table_number: Optional[str]
    order_status: str
    confirmed_at: Optional[datetime]
    items: List[OrderVoucherItemDetail]
    items_snapshot: Optional[List[OrderVoucherItemDetail]] = None
    subtotal: str
    tax: str
    service_charge: str
    discount: str
    total_amount: str
    currency: str = "MMK"
    notice: str = "Total amount only. This voucher confirms food preparation and is not a payment receipt."

class OrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: Optional[int]
    table_id: Optional[int] = None
    order_type: str
    status: str
    table_number: Optional[str]
    delivery_address: Optional[str]
    special_instructions: Optional[str] = None
    total_amount: Decimal
    currency: str = "MMK"
    current_round: int
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    confirmed_total: Optional[Decimal] = None
    preparing_at: Optional[datetime] = None
    preparation_duration_seconds: Optional[int] = None
    preparation_due_at: Optional[datetime] = None
    cooking_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    has_voucher: bool = False
    voucher_number: Optional[str] = None
    voucher: Optional[OrderVoucherResponse] = None
    items: List[OrderItemResponse] = []
    status_history: List[OrderStatusHistoryResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BestSellerItem(BaseModel):
    item_name: str
    total_quantity: int
    total_revenue: float
    order_count: int = 0
    percentage: float = 0.0

class DailySalesTimeline(BaseModel):
    date: str
    sales: float
    orders: int
    completed_orders: int = 0
    cancelled_orders: int = 0

class AdminAnalyticsResponse(BaseModel):
    currency: str = "MMK"
    date_range: str
    today_sales: float
    today_orders_count: int
    completed_orders_count: int
    pending_orders_count: int
    cancelled_orders_count: int
    average_order_value: float
    active_tables_count: int = 0
    total_tables_count: int = 0
    best_sellers: List[BestSellerItem]
    daily_sales_timeline: List[DailySalesTimeline]
