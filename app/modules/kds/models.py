from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.common.enums import TicketStatus, KitchenStation

class KitchenTicket(Base):
    __tablename__ = "kitchen_tickets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    round_number = Column(Integer, default=1, nullable=False)
    station = Column(String(50), default=KitchenStation.MAIN_KITCHEN.value, nullable=False, index=True)
    status = Column(String(50), default=TicketStatus.NEW.value, nullable=False, index=True)
    ticket_items = Column(JSON, nullable=False)  # List of dicts: [{"product_id": 1, "item_name": "Fried Rice", "quantity": 2, "notes": "No onions"}]
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="kitchen_tickets", lazy="selectin")

    @property
    def table_number(self):
        return self.order.table_number if self.order else None

    @property
    def special_instructions(self):
        return self.order.special_instructions if self.order else None

    @property
    def preparing_at(self):
        return self.order.preparing_at if self.order else None

    @property
    def preparation_due_at(self):
        return self.order.preparation_due_at if self.order else None

    @property
    def preparation_duration_seconds(self):
        return self.order.preparation_duration_seconds if self.order else None

    @property
    def cooking_at(self):
        return self.order.cooking_at if self.order else None

