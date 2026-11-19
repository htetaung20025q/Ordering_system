from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.common.enums import OrderType, OrderStatus, KitchenStation

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_number = Column(String(50), unique=True, index=True, nullable=False)
    customer_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    table_id = Column(Integer, ForeignKey("restaurant_tables.id", ondelete="SET NULL"), nullable=True, index=True)
    order_type = Column(String(50), default=OrderType.DINE_IN.value, nullable=False)
    status = Column(String(50), default=OrderStatus.PENDING.value, nullable=False, index=True)
    table_number = Column(String(50), nullable=True)
    delivery_address = Column(Text, nullable=True)
    special_instructions = Column(Text, nullable=True)
    total_amount = Column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    currency = Column(String(10), default="MMK", nullable=False)
    current_round = Column(Integer, default=1, nullable=False)

    # Confirmation & Voucher Metadata
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    confirmed_total = Column(Numeric(12, 2), nullable=True)

    # Semi-Automatic Preparation & Cooking Lifecycle Timestamps
    preparing_at = Column(DateTime(timezone=True), nullable=True)
    preparation_duration_seconds = Column(Integer, default=300, nullable=True)
    preparation_due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    cooking_at = Column(DateTime(timezone=True), nullable=True)
    ready_at = Column(DateTime(timezone=True), nullable=True)
    picked_up_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    kitchen_tickets = relationship("KitchenTicket", back_populates="order", cascade="all, delete-orphan", lazy="selectin")
    table = relationship("RestaurantTable", back_populates="orders", lazy="selectin")
    voucher = relationship("OrderVoucher", back_populates="order", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    status_history = relationship("OrderStatusHistory", back_populates="order", cascade="all, delete-orphan", order_by="OrderStatusHistory.changed_timestamp.asc()", lazy="selectin")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    item_name = Column(String(150), nullable=False)          # Authoritative snapshot
    unit_price = Column(Numeric(12, 2), nullable=False)       # Authoritative snapshot
    quantity = Column(Integer, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    round_number = Column(Integer, default=1, nullable=False)
    station = Column(String(50), default=KitchenStation.MAIN_KITCHEN.value, nullable=False)
    special_instructions = Column(Text, nullable=True)
    prep_time_minutes = Column(Integer, default=5, nullable=False)

    order = relationship("Order", back_populates="items")

    # Snapshot property aliases
    @property
    def item_name_snapshot(self) -> str:
        return self.item_name

    @property
    def unit_price_snapshot(self) -> Decimal:
        return self.unit_price

class OrderVoucher(Base):
    __tablename__ = "order_vouchers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    voucher_number = Column(String(64), unique=True, nullable=False, index=True)
    pdf_storage_key = Column(Text, nullable=True)
    generated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)

    order = relationship("Order", back_populates="voucher")

class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_system = Column(Boolean, default=False, nullable=False)
    actor_type = Column(String(20), default="user", nullable=False)
    notes = Column(Text, nullable=True)
    changed_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="status_history")
