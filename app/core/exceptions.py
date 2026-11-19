from fastapi import HTTPException, status

class DomainException(HTTPException):
    def __init__(self, detail: str = "", status_code: int = status.HTTP_400_BAD_REQUEST, **kwargs):
        # Allow positional status_code: DomainException(404, "Not Found")
        if isinstance(detail, int):
            status_code, detail = detail, kwargs.get("detail", "")
        # Allow keyword detail if kwargs passed
        if "detail" in kwargs:
            detail = kwargs["detail"]
        super().__init__(status_code=status_code, detail=detail)

class EntityNotFoundError(DomainException):
    def __init__(self, entity_name: str, identifier: any):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{entity_name} with identifier '{identifier}' was not found"
        )

class InsufficientStockError(DomainException):
    def __init__(self, product_name: str, available: int, requested: int):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for product '{product_name}'. Requested: {requested}, Available: {available}"
        )

class PaymentFailedError(DomainException):
    def __init__(self, reason: str):
        super().__init__(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Payment transaction failed: {reason}"
        )

class InvalidStatusTransitionError(DomainException):
    def __init__(self, current_status: str, target_status: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition status from '{current_status}' to '{target_status}'"
        )

class ConflictError(DomainException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=message
        )

