import io
import time
import secrets
from datetime import datetime, timezone
from typing import List, Optional
import qrcode
import qrcode.image.svg
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import DomainException
from app.modules.table.models import RestaurantTable
from app.modules.table.schemas import TableCreate, TableUpdate, TableResponse, TableResolveResponse, TableRotateResponse

def generate_opaque_qr_token() -> str:
    """Generates a secure, non-predictable cryptographic opaque QR token."""
    ts_hex = f"{int(time.time()):x}"
    rand_hex = secrets.token_hex(16)
    return f"qr_{ts_hex}_{rand_hex}"

class TableService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tables(self, restaurant_id: int = 1) -> List[TableResponse]:
        res = await self.db.execute(
            select(RestaurantTable)
            .where(RestaurantTable.restaurant_id == restaurant_id)
            .order_by(RestaurantTable.table_number.asc())
        )
        tables = res.scalars().all()
        # For each table, attach active orders count
        from app.modules.order.models import Order
        response_list = []
        for t in tables:
            active_count_res = await self.db.execute(
                select(func.count(Order.id))
                .where(
                    and_(
                        Order.table_id == t.id,
                        Order.status.notin_(["picked_up", "completed", "cancelled"])
                    )
                )
            )
            count = active_count_res.scalar() or 0
            response_list.append(TableResponse(
                id=t.id,
                restaurant_id=t.restaurant_id,
                table_number=t.table_number,
                seating_capacity=t.seating_capacity,
                qr_token=t.qr_token,
                is_active=t.is_active,
                revoked_at=t.revoked_at,
                created_at=t.created_at,
                updated_at=t.updated_at,
                active_orders_count=count
            ))
        return response_list

    async def get_table_by_id(self, table_id: int) -> RestaurantTable:
        res = await self.db.execute(select(RestaurantTable).where(RestaurantTable.id == table_id))
        table = res.scalar_one_or_none()
        if not table:
            raise DomainException("Restaurant table not found", status_code=404)
        return table

    async def create_table(self, data: TableCreate, restaurant_id: int = 1) -> TableResponse:
        # Check duplicate table number
        dup = await self.db.execute(
            select(RestaurantTable).where(
                and_(
                    RestaurantTable.restaurant_id == restaurant_id,
                    RestaurantTable.table_number == data.table_number
                )
            )
        )
        if dup.scalar_one_or_none():
            raise DomainException(f"Table '{data.table_number}' already exists in this restaurant", status_code=409)

        token = generate_opaque_qr_token()
        table = RestaurantTable(
            restaurant_id=restaurant_id,
            table_number=data.table_number,
            seating_capacity=data.seating_capacity,
            qr_token=token,
            is_active=data.is_active
        )
        self.db.add(table)
        await self.db.commit()
        await self.db.refresh(table)
        return TableResponse.model_validate(table)

    async def update_table(self, table_id: int, data: TableUpdate) -> TableResponse:
        table = await self.get_table_by_id(table_id)
        if data.table_number is not None:
            table.table_number = data.table_number
        if data.seating_capacity is not None:
            table.seating_capacity = data.seating_capacity
        if data.is_active is not None:
            table.is_active = data.is_active
        await self.db.commit()
        await self.db.refresh(table)
        return TableResponse.model_validate(table)

    async def rotate_qr_token(self, table_id: int) -> TableRotateResponse:
        table = await self.get_table_by_id(table_id)
        old_token = table.qr_token
        new_token = generate_opaque_qr_token()
        now = datetime.now(timezone.utc)

        table.qr_token = new_token
        table.updated_at = now
        await self.db.commit()

        return TableRotateResponse(
            table_id=table.id,
            table_number=table.table_number,
            old_qr_token=old_token,
            previous_qr_token=old_token,
            new_qr_token=new_token,
            qr_token=new_token,
            rotated_at=now
        )

    async def resolve_table_by_token(self, token: str) -> TableResolveResponse:
        res = await self.db.execute(
            select(RestaurantTable).where(RestaurantTable.qr_token == token)
        )
        table = res.scalar_one_or_none()
        if not table:
            raise DomainException("Invalid or non-existent Table QR token", status_code=404)
        if not table.is_active:
            raise DomainException("This table has been deactivated by management", status_code=403)
        if table.revoked_at is not None:
            raise DomainException("This QR token has been revoked. Please scan the current table QR.", status_code=403)

        return TableResolveResponse(
            table_id=table.id,
            table_number=table.table_number,
            seating_capacity=table.seating_capacity,
            restaurant_id=table.restaurant_id,
            restaurant_name="FLOW-SYS Bistro Yangon",
            currency="MMK",
            is_active=table.is_active,
            qr_token=table.qr_token
        )

    async def delete_table(self, table_id: int) -> dict:
        table = await self.get_table_by_id(table_id)

        # Check for active orders associated with this table
        from app.modules.order.models import Order
        active_count_res = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.table_id == table_id,
                    Order.status.notin_(["picked_up", "completed", "cancelled"])
                )
            )
        )
        active_count = active_count_res.scalar() or 0
        if active_count > 0:
            raise DomainException(
                f"Cannot delete table '{table.table_number}' because it has {active_count} active order(s). "
                "Complete or cancel active orders first, or deactivate the table.",
                status_code=400
            )

        table_name = table.table_number
        await self.db.delete(table)
        await self.db.commit()

        return {
            "message": f"Table '{table_name}' has been deleted successfully",
            "table_id": table_id
        }

    async def generate_table_card_image(self, table_id: int, base_url: str = "http://localhost:8000") -> bytes:
        from PIL import Image, ImageDraw, ImageFont
        table = await self.get_table_by_id(table_id)
        target_url = f"{base_url}/?qr={table.qr_token}"

        w, h = 800, 1150
        img = Image.new("RGB", (w, h), color=(255, 255, 255))
        draw = ImageDraw.Draw(img)

        # Fonts
        font_bold_path = "/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf"
        font_reg_path = "/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Regular.otf"
        try:
            f_title = ImageFont.truetype(font_bold_path, 30)
            f_sub = ImageFont.truetype(font_reg_path, 16)
            f_table = ImageFont.truetype(font_bold_path, 40)
            f_cap = ImageFont.truetype(font_reg_path, 18)
            f_inst = ImageFont.truetype(font_bold_path, 17)
            f_inst_sub = ImageFont.truetype(font_reg_path, 15)
            f_foot = ImageFont.truetype(font_reg_path, 14)
        except Exception:
            f_title = f_sub = f_table = f_cap = f_inst = f_inst_sub = f_foot = ImageFont.load_default()

        # Outer border
        draw.rounded_rectangle([(24, 24), (w - 24, h - 24)], radius=24, outline=(226, 232, 240), width=3)

        # Header
        draw.text((w // 2, 60), "FLOW-SYS BISTRO", font=f_title, fill=(15, 23, 42), anchor="mt")
        draw.text((w // 2, 100), "CONTACTLESS DINING & ORDERING", font=f_sub, fill=(100, 116, 139), anchor="mt")

        # Table Badge
        draw.rounded_rectangle([(80, 135), (w - 80, 245)], radius=20, fill=(15, 23, 42))
        table_label = table.table_number.upper()
        if not table_label.startswith("TABLE"):
            table_label = f"TABLE {table_label}"
        draw.text((w // 2, 155), table_label, font=f_table, fill=(255, 255, 255), anchor="mt")
        draw.text((w // 2, 205), f"Capacity: {table.seating_capacity} Guests", font=f_cap, fill=(203, 213, 225), anchor="mt")

        # QR Code
        qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_Q, box_size=11, border=2)
        qr.add_data(target_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="#0f172a", back_color="white").convert("RGB")
        qr_w, qr_h = qr_img.size
        qr_x = (w - qr_w) // 2
        qr_y = 275

        draw.rounded_rectangle([(qr_x - 12, qr_y - 12), (qr_x + qr_w + 12, qr_y + qr_h + 12)], radius=16, outline=(241, 245, 249), width=2)
        img.paste(qr_img, (qr_x, qr_y))

        # Instructions box
        inst_y = qr_y + qr_h + 40
        draw.rounded_rectangle([(80, inst_y), (w - 80, inst_y + 115)], radius=18, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((w // 2, inst_y + 18), "HOW TO ORDER FROM YOUR PHONE", font=f_inst, fill=(15, 23, 42), anchor="mt")
        draw.text((w // 2, inst_y + 48), "1. Open Camera   •   2. Scan Table QR   •   3. Browse & Place Order", font=f_inst_sub, fill=(71, 85, 105), anchor="mt")
        draw.text((w // 2, inst_y + 76), "Orders are sent directly to the kitchen in real time.", font=f_inst_sub, fill=(100, 116, 139), anchor="mt")

        # Footer
        draw.text((w // 2, h - 65), f"FLOW-SYS OPAQUE QR AUTHENTICATED • {table_label}", font=f_foot, fill=(148, 163, 184), anchor="mt")

        stream = io.BytesIO()
        img.save(stream, format="PNG")
        return stream.getvalue()

    async def generate_qr_image(self, table_id: int, format: str = "png", base_url: str = "http://localhost:8000") -> bytes:
        table = await self.get_table_by_id(table_id)
        target_url = f"{base_url}/?qr={table.qr_token}"

        if format.lower() == "svg":
            factory = qrcode.image.svg.SvgImage
            img = qrcode.make(target_url, image_factory=factory, error_correction=qrcode.constants.ERROR_CORRECT_Q)
            stream = io.BytesIO()
            img.save(stream)
            return stream.getvalue()
        else:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_Q,
                box_size=10,
                border=4
            )
            qr.add_data(target_url)
            qr.make(fit=True)
            img = qr.make_image(fill_color="#1f242e", back_color="white")
            stream = io.BytesIO()
            img.save(stream, format="PNG")
            return stream.getvalue()
