from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class TableCreate(BaseModel):
    table_number: str = Field(..., min_length=1, max_length=50, description="e.g. Table 01")
    seating_capacity: int = Field(default=4, ge=1, le=50)
    is_active: bool = True

class TableUpdate(BaseModel):
    table_number: Optional[str] = Field(None, min_length=1, max_length=50)
    seating_capacity: Optional[int] = Field(None, ge=1, le=50)
    is_active: Optional[bool] = None

class TableResponse(BaseModel):
    id: int
    restaurant_id: int
    table_number: str
    seating_capacity: int
    qr_token: str
    is_active: bool
    revoked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    active_orders_count: int = 0

    model_config = ConfigDict(from_attributes=True)

class TableResolveResponse(BaseModel):
    table_id: int
    table_number: str
    seating_capacity: int = 4
    restaurant_id: int
    restaurant_name: str
    currency: str
    is_active: bool
    qr_token: str

class TableRotateResponse(BaseModel):
    table_id: int
    table_number: str
    old_qr_token: str
    previous_qr_token: Optional[str] = None
    new_qr_token: str
    qr_token: Optional[str] = None
    rotated_at: datetime
