from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from datetime import datetime
from app.common.enums import KitchenStation

# --- Category Schemas ---
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    is_active: bool = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Product Schemas ---
class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    price: Decimal = Field(..., gt=0, decimal_places=2)
    sku: str = Field(..., min_length=2, max_length=50)
    is_available: bool = True
    prep_time_minutes: int = Field(default=5, ge=1)
    station: KitchenStation = KitchenStation.MAIN_KITCHEN
    initial_stock: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)

class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    sku: Optional[str] = None
    is_available: Optional[bool] = None
    prep_time_minutes: Optional[int] = Field(None, ge=1)
    station: Optional[KitchenStation] = None

class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str]
    price: Decimal
    sku: str
    is_available: bool
    prep_time_minutes: int = 5
    station: str
    current_stock: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Stock Schemas ---
class StockResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    current_stock: int
    low_stock_threshold: int
    is_low_stock: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StockUpdate(BaseModel):
    current_stock: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)

# --- Inventory Adjustment Schemas ---
class InventoryAdjustmentCreate(BaseModel):
    product_id: int
    change_quantity: int  # can be positive or negative, non-zero
    reason: str = Field(..., min_length=3, max_length=255)

class InventoryAdjustmentUpdate(BaseModel):
    reason: str = Field(..., min_length=3, max_length=255)

class InventoryAdjustmentResponse(BaseModel):
    id: int
    product_id: int
    change_quantity: int
    reason: str
    adjusted_by_user_id: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
