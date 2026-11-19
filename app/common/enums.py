from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    CASHIER = "cashier"
    WAITER = "waiter"
    KITCHEN = "kitchen"
    CUSTOMER = "customer"

class OrderType(str, Enum):
    DINE_IN = "dine_in"
    PICKUP = "pickup"
    DELIVERY = "delivery"

class OrderStatus(str, Enum):
    # Canonical Approved Lifecycle
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PREPARING = "preparing"
    COOKING = "cooking"
    READY = "ready"
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"
    # Backwards-compatible aliases
    NEW = "new"
    ACCEPTED = "accepted"
    SERVED = "served"
    COMPLETED = "completed"

class TicketStatus(str, Enum):
    NEW = "new"
    ACCEPTED = "accepted"
    PREPARING = "preparing"
    COOKING = "cooking"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    EWALLET = "ewallet"
    OTHER = "other"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"

class KitchenStation(str, Enum):
    MAIN_KITCHEN = "main_kitchen"
    BAR = "bar"
    DESSERT = "dessert"
