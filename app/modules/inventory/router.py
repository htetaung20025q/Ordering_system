from typing import List, Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.common.enums import UserRole
from app.modules.auth.models import User
from app.modules.inventory.schemas import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    ProductCreate, ProductUpdate, ProductResponse,
    StockResponse, StockUpdate,
    InventoryAdjustmentCreate, InventoryAdjustmentUpdate, InventoryAdjustmentResponse
)
from app.modules.inventory.service import InventoryService

router = APIRouter(tags=["Inventory Management"])

# ================= Categories Endpoints =================
@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.create_category(data)

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    service = InventoryService(db)
    return await service.list_categories(active_only=active_only)

@router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = InventoryService(db)
    return await service.get_category_by_id(category_id)

@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.update_category(category_id, data)

@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    await service.delete_category(category_id)
    return None

# ================= Products Endpoints =================
@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    product = await service.create_product(data)
    return ProductResponse(
        id=product.id,
        category_id=product.category_id,
        name=product.name,
        description=product.description,
        price=product.price,
        sku=product.sku,
        is_available=product.is_available,
        prep_time_minutes=getattr(product, "prep_time_minutes", 5) or 5,
        station=product.station,
        current_stock=product.stock.current_stock if product.stock else 0,
        created_at=product.created_at,
        updated_at=product.updated_at
    )

@router.get("/products", response_model=List[ProductResponse])
async def list_products(
    category_id: Optional[int] = None,
    available_only: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    service = InventoryService(db)
    products = await service.list_products(category_id=category_id, available_only=available_only, skip=skip, limit=limit)
    return [
        ProductResponse(
            id=p.id,
            category_id=p.category_id,
            name=p.name,
            description=p.description,
            price=p.price,
            sku=p.sku,
            is_available=p.is_available,
            prep_time_minutes=getattr(p, "prep_time_minutes", 5) or 5,
            station=p.station,
            current_stock=p.stock.current_stock if p.stock else 0,
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in products
    ]

@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db)
):
    service = InventoryService(db)
    p = await service.get_product_by_id(product_id)
    return ProductResponse(
        id=p.id,
        category_id=p.category_id,
        name=p.name,
        description=p.description,
        price=p.price,
        sku=p.sku,
        is_available=p.is_available,
        prep_time_minutes=getattr(p, "prep_time_minutes", 5) or 5,
        station=p.station,
        current_stock=p.stock.current_stock if p.stock else 0,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    p = await service.update_product(product_id, data)
    return ProductResponse(
        id=p.id,
        category_id=p.category_id,
        name=p.name,
        description=p.description,
        price=p.price,
        sku=p.sku,
        is_available=p.is_available,
        prep_time_minutes=getattr(p, "prep_time_minutes", 5) or 5,
        station=p.station,
        current_stock=p.stock.current_stock if p.stock else 0,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    await service.delete_product(product_id)
    return None

# ================= Stock Tracking Endpoints =================
@router.get("/stocks", response_model=List[StockResponse])
async def list_stocks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.KITCHEN]))
):
    service = InventoryService(db)
    stocks = await service.list_stocks()
    return [
        StockResponse(
            id=s.id,
            product_id=s.product_id,
            product_name=s.product.name if s.product else f"Product #{s.product_id}",
            current_stock=s.current_stock,
            low_stock_threshold=s.low_stock_threshold,
            is_low_stock=(s.current_stock <= s.low_stock_threshold),
            updated_at=s.updated_at
        )
        for s in stocks
    ]

@router.get("/stocks/{product_id}", response_model=StockResponse)
async def get_stock(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER, UserRole.KITCHEN]))
):
    service = InventoryService(db)
    s = await service.get_stock_by_product_id(product_id)
    return StockResponse(
        id=s.id,
        product_id=s.product_id,
        product_name=s.product.name if s.product else f"Product #{s.product_id}",
        current_stock=s.current_stock,
        low_stock_threshold=s.low_stock_threshold,
        is_low_stock=(s.current_stock <= s.low_stock_threshold),
        updated_at=s.updated_at
    )

@router.put("/stocks/{product_id}", response_model=StockResponse)
async def update_stock(
    product_id: int,
    data: StockUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    s = await service.update_stock(product_id, data)
    return StockResponse(
        id=s.id,
        product_id=s.product_id,
        product_name=s.product.name if s.product else f"Product #{s.product_id}",
        current_stock=s.current_stock,
        low_stock_threshold=s.low_stock_threshold,
        is_low_stock=(s.current_stock <= s.low_stock_threshold),
        updated_at=s.updated_at
    )

@router.delete("/stocks/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stock(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    await service.delete_stock(product_id)
    return None

# ================= Inventory Adjustment Endpoints =================
@router.post("/inventory-adjustments", response_model=InventoryAdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_adjustment(
    data: InventoryAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.create_inventory_adjustment(data, user_id=current_user.id)

@router.get("/inventory-adjustments", response_model=List[InventoryAdjustmentResponse])
async def list_inventory_adjustments(
    product_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.list_inventory_adjustments(product_id=product_id, skip=skip, limit=limit)

@router.get("/inventory-adjustments/{adjustment_id}", response_model=InventoryAdjustmentResponse)
async def get_inventory_adjustment(
    adjustment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.get_inventory_adjustment_by_id(adjustment_id)

@router.put("/inventory-adjustments/{adjustment_id}", response_model=InventoryAdjustmentResponse)
async def update_inventory_adjustment(
    adjustment_id: int,
    data: InventoryAdjustmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.MANAGER]))
):
    service = InventoryService(db)
    return await service.update_inventory_adjustment(adjustment_id, data)

@router.delete("/inventory-adjustments/{adjustment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_adjustment(
    adjustment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN]))
):
    service = InventoryService(db)
    await service.delete_inventory_adjustment(adjustment_id)
    return None

