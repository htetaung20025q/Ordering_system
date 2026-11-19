from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "FLOW-SYS Ordering & Management API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./ordering_system.db"
    DATABASE_ECHO: bool = False
    
    # Security Settings
    SECRET_KEY: str = "flowsys-super-secret-production-grade-signing-key-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Administrative & Staff Initial Credentials (Configured via .env)
    ADMIN_USERNAME: str = "admin"
    ADMIN_EMAIL: str = "admin@flowsys.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_FULL_NAME: str = "System Administrator"

    KITCHEN_USERNAME: str = "kitchen"
    KITCHEN_EMAIL: str = "kitchen@flowsys.com"
    KITCHEN_PASSWORD: str = "kitchen123"
    KITCHEN_FULL_NAME: str = "Chief Chef"

    MANAGER_USERNAME: str = "manager"
    MANAGER_EMAIL: str = "manager@flowsys.com"
    MANAGER_PASSWORD: str = "manager123"
    MANAGER_FULL_NAME: str = "Restaurant Manager"

    CUSTOMER_USERNAME: str = "customer"
    CUSTOMER_EMAIL: str = "customer@flowsys.com"
    CUSTOMER_PASSWORD: str = "customer123"
    CUSTOMER_FULL_NAME: str = "Jane Diner"
    
    # Financial Settings
    CURRENCY: str = "MMK"
    CURRENCY_SYMBOL: str = "MMK"
    DEFAULT_TAX_RATE: float = 0.05
    DEFAULT_SERVICE_CHARGE_RATE: float = 0.10
    
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="allow"
    )

settings = Settings()
