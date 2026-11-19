from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from app.modules.inventory.models import Category, Product, Stock, InventoryAdjustment
from app.modules.inventory.schemas import (
    CategoryCreate, CategoryUpdate,
    ProductCreate, ProductUpdate,
    StockUpdate, StockResponse,
    InventoryAdjustmentCreate, InventoryAdjustmentUpdate
)
from app.core.exceptions import EntityNotFoundError, ConflictError, InsufficientStockError

class InventoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ================= Category Operations =================
    async def create_category(self, data: CategoryCreate) -> Category:
        existing = await self.db.execute(select(Category).where(Category.name == data.name))
        if existing.scalar_one_or_none():
            raise ConflictError(f"Category with name '{data.name}' already exists")
        
        category = Category(name=data.name, description=data.description, is_active=data.is_active)
        self.db.add(category)
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def get_category_by_id(self, category_id: int) -> Category:
        result = await self.db.execute(select(Category).where(Category.id == category_id))
        category = result.scalar_one_or_none()
        if not category:
            raise EntityNotFoundError("Category", category_id)
        return category

    async def list_categories(self, active_only: bool = False) -> List[Category]:
        stmt = select(Category)
        if active_only:
            stmt = stmt.where(Category.is_active == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_category(self, category_id: int, data: CategoryUpdate) -> Category:
        category = await self.get_category_by_id(category_id)
        if data.name is not None and data.name != category.name:
            existing = await self.db.execute(select(Category).where(Category.name == data.name))
            if existing.scalar_one_or_none():
                raise ConflictError(f"Category with name '{data.name}' already exists")
            category.name = data.name
        if data.description is not None:
            category.description = data.description
        if data.is_active is not None:
            category.is_active = data.is_active
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def delete_category(self, category_id: int) -> None:
        category = await self.get_category_by_id(category_id)
        await self.db.delete(category)
        await self.db.commit()

    # ================= Product Operations =================
    async def create_product(self, data: ProductCreate) -> Product:
        # Check category exists
        await self.get_category_by_id(data.category_id)
        
        # Check SKU uniqueness
        sku_check = await self.db.execute(select(Product).where(Product.sku == data.sku))
        if sku_check.scalar_one_or_none():
            raise ConflictError(f"Product with SKU '{data.sku}' already exists")

        product = Product(
            category_id=data.category_id,
            name=data.name,
            description=data.description,
            price=data.price,
            sku=data.sku,
            is_available=data.is_available,
            prep_time_minutes=getattr(data, "prep_time_minutes", 5) or 5,
            station=data.station.value if hasattr(data.station, "value") else str(data.station)
        )
        self.db.add(product)
        await self.db.flush()

        stock = Stock(
            product_id=product.id,
            current_stock=data.initial_stock,
            low_stock_threshold=data.low_stock_threshold
        )
        self.db.add(stock)
        await self.db.commit()
        await self.db.refresh(product)
        # load stock
        await self.db.refresh(product, attribute_names=["stock"])
        return product

    async def get_product_by_id(self, product_id: int) -> Product:
        result = await self.db.execute(
            select(Product).options(selectinload(Product.stock), selectinload(Product.category)).where(Product.id == product_id)
        )
        product = result.scalar_one_or_none()
        if not product:
            raise EntityNotFoundError("Product", product_id)
        return product

    async def list_products(
        self,
        category_id: Optional[int] = None,
        available_only: bool = False,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        stmt = select(Product).options(selectinload(Product.stock), selectinload(Product.category))
        if category_id is not None:
            stmt = stmt.where(Product.category_id == category_id)
        if available_only:
            stmt = stmt.where(Product.is_available == True)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_product(self, product_id: int, data: ProductUpdate) -> Product:
        product = await self.get_product_by_id(product_id)
        if data.category_id is not None:
            await self.get_category_by_id(data.category_id)
            product.category_id = data.category_id
        if data.sku is not None and data.sku != product.sku:
            sku_check = await self.db.execute(select(Product).where(Product.sku == data.sku))
            if sku_check.scalar_one_or_none():
                raise ConflictError(f"Product with SKU '{data.sku}' already exists")
            product.sku = data.sku
        if data.name is not None:
            product.name = data.name
        if data.description is not None:
            product.description = data.description
        if data.price is not None:
            product.price = data.price
        if data.is_available is not None:
            product.is_available = data.is_available
        if data.prep_time_minutes is not None:
            product.prep_time_minutes = data.prep_time_minutes
        if data.station is not None:
            product.station = data.station.value if hasattr(data.station, "value") else str(data.station)
        
        await self.db.commit()
        await self.db.refresh(product, attribute_names=["stock", "category"])
        return product

    async def delete_product(self, product_id: int) -> None:
        product = await self.get_product_by_id(product_id)
        await self.db.delete(product)
        await self.db.commit()

    # ================= Stock Tracking Operations =================
    async def get_stock_by_product_id(self, product_id: int) -> Stock:
        result = await self.db.execute(
            select(Stock).options(selectinload(Stock.product)).where(Stock.product_id == product_id)
        )
        stock = result.scalar_one_or_none()
        if not stock:
            raise EntityNotFoundError("Stock for Product", product_id)
        return stock

    async def list_stocks(self) -> List[Stock]:
        result = await self.db.execute(select(Stock).options(selectinload(Stock.product)))
        return list(result.scalars().all())

    async def update_stock(self, product_id: int, data: StockUpdate) -> Stock:
        stock = await self.get_stock_by_product_id(product_id)
        if data.current_stock is not None:
            stock.current_stock = data.current_stock
        if data.low_stock_threshold is not None:
            stock.low_stock_threshold = data.low_stock_threshold
        await self.db.commit()
        await self.db.refresh(stock, attribute_names=["product"])
        return stock

    async def delete_stock(self, product_id: int) -> None:
        stock = await self.get_stock_by_product_id(product_id)
        stock.current_stock = 0
        await self.db.commit()

    # ================= Inventory Adjustment Operations =================
    async def create_inventory_adjustment(
        self,
        data: InventoryAdjustmentCreate,
        user_id: Optional[int] = None
    ) -> InventoryAdjustment:
        # Atomic lock/update on Stock
        stock = await self.get_stock_by_product_id(data.product_id)
        new_quantity = stock.current_stock + data.change_quantity
        if new_quantity < 0:
            raise InsufficientStockError(
                product_name=stock.product.name if stock.product else f"ID {data.product_id}",
                available=stock.current_stock,
                requested=abs(data.change_quantity)
            )

        stock.current_stock = new_quantity
        adjustment = InventoryAdjustment(
            product_id=data.product_id,
            change_quantity=data.change_quantity,
            reason=data.reason,
            adjusted_by_user_id=user_id
        )
        self.db.add(adjustment)
        await self.db.commit()
        await self.db.refresh(adjustment)
        return adjustment

    async def get_inventory_adjustment_by_id(self, adjustment_id: int) -> InventoryAdjustment:
        result = await self.db.execute(
            select(InventoryAdjustment).where(InventoryAdjustment.id == adjustment_id)
        )
        adj = result.scalar_one_or_none()
        if not adj:
            raise EntityNotFoundError("InventoryAdjustment", adjustment_id)
        return adj

    async def list_inventory_adjustments(
        self,
        product_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[InventoryAdjustment]:
        stmt = select(InventoryAdjustment)
        if product_id is not None:
            stmt = stmt.where(InventoryAdjustment.product_id == product_id)
        stmt = stmt.order_by(InventoryAdjustment.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_inventory_adjustment(
        self,
        adjustment_id: int,
        data: InventoryAdjustmentUpdate
    ) -> InventoryAdjustment:
        adj = await self.get_inventory_adjustment_by_id(adjustment_id)
        adj.reason = data.reason
        await self.db.commit()
        await self.db.refresh(adj)
        return adj

    async def delete_inventory_adjustment(self, adjustment_id: int) -> None:
        adj = await self.get_inventory_adjustment_by_id(adjustment_id)
        # Revert the adjustment quantity back to stock
        stock = await self.get_stock_by_product_id(adj.product_id)
        reverted_stock = stock.current_stock - adj.change_quantity
        if reverted_stock < 0:
            raise ConflictError("Cannot delete adjustment because it would reduce current stock below 0")
        stock.current_stock = reverted_stock
        await self.db.delete(adj)
        await self.db.commit()

