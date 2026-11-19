from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime
from app.common.enums import TicketStatus, KitchenStation

class TicketItemDetail(BaseModel):
    product_id: int
    item_name: str
    quantity: int = Field(..., gt=0)
    notes: Optional[str] = None
    special_instructions: Optional[str] = None

class KitchenTicketResponse(BaseModel):
    id: int
    order_id: int
    round_number: int
    station: str
    status: str
    ticket_items: List[TicketItemDetail]
    table_number: Optional[str] = None
    special_instructions: Optional[str] = None
    preparing_at: Optional[datetime] = None
    preparation_due_at: Optional[datetime] = None
    preparation_duration_seconds: Optional[int] = None
    cooking_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class KitchenTicketUpdate(BaseModel):
    status: Optional[TicketStatus] = None
    bump: Optional[bool] = False
