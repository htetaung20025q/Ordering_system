from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.common.enums import PaymentMethod, PaymentStatus

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_method = Column(String(50), default=PaymentMethod.CARD.value, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(50), default=PaymentStatus.PENDING.value, nullable=False, index=True)
    transaction_reference = Column(String(100), unique=True, index=True, nullable=False)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    order = relationship("Order", back_populates="payments")

