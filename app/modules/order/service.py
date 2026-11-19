import io
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.modules.order.models import Order, OrderItem, OrderVoucher, OrderStatusHistory
from app.modules.order.schemas import (
    OrderCreate,
    OrderUpdate,
    AddRoundRequest,
    OrderVoucherResponse,
    OrderVoucherItemDetail
)
from app.modules.inventory.models import Product, Stock
from app.modules.kds.models import KitchenTicket
from app.modules.kds.service import KDSService
from app.modules.table.models import RestaurantTable
from app.common.enums import OrderStatus, TicketStatus, PaymentStatus
from app.core.exceptions import EntityNotFoundError, InsufficientStockError, ConflictError, DomainException

def format_mmk(amount: Decimal) -> str:
    return f"{int(round(amount)):,} MMK"

class OrderService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.kds_service = KDSService(db)

    async def get_order_by_id(self, order_id: int) -> Order:
        result = await self.db.execute(
            select(Order)
            .options(
                selectinload(Order.items),
                selectinload(Order.payments),
                selectinload(Order.kitchen_tickets),
                selectinload(Order.voucher),
                selectinload(Order.status_history)
            )
            .where(Order.id == order_id)
        )
        order = result.scalar_one_or_none()
        if not order:
            raise EntityNotFoundError("Order", order_id)
        return order

    async def list_orders(
        self,
        customer_id: Optional[int] = None,
        table_id: Optional[int] = None,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Order]:
        stmt = select(Order).options(
            selectinload(Order.items),
            selectinload(Order.voucher),
            selectinload(Order.status_history)
        )
        if customer_id is not None:
            stmt = stmt.where(Order.customer_id == customer_id)
        if table_id is not None:
            stmt = stmt.where(Order.table_id == table_id)
        if status is not None:
            stmt = stmt.where(Order.status == status)
        stmt = stmt.order_by(Order.created_at.desc()).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_order(
        self,
        data: OrderCreate,
        customer_id: Optional[int] = None,
        auto_commit: bool = True
    ) -> Order:
        order_number = f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        
        resolved_table_id = None
        table_number = data.table_number

        # If qr_token is passed, resolve the table securely
        if data.qr_token:
            table_res = await self.db.execute(
                select(RestaurantTable).where(RestaurantTable.qr_token == data.qr_token)
            )
            table_obj = table_res.scalar_one_or_none()
            if not table_obj:
                raise DomainException("Invalid or non-existent Table QR token", status_code=400)
            if not table_obj.is_active or table_obj.revoked_at is not None:
                raise DomainException("This Table QR token has been revoked or deactivated", status_code=403)
            resolved_table_id = table_obj.id
            table_number = table_obj.table_number

        order = Order(
            order_number=order_number,
            customer_id=customer_id,
            table_id=resolved_table_id,
            order_type=data.order_type.value,
            status=OrderStatus.PENDING.value,
            table_number=table_number,
            delivery_address=data.delivery_address,
            special_instructions=data.special_instructions,
            total_amount=Decimal("0.00"),
            currency="MMK",
            current_round=1
        )
        self.db.add(order)
        await self.db.flush()

        # Record Initial Status History
        history = OrderStatusHistory(
            order_id=order.id,
            previous_status=None,
            new_status=OrderStatus.PENDING.value,
            changed_by=customer_id
        )
        self.db.add(history)

        total_amount = Decimal("0.00")
        station_items_map: Dict[str, List[dict]] = {}

        for item_data in data.items:
            product_res = await self.db.execute(
                select(Product).where(Product.id == item_data.product_id)
            )
            product = product_res.scalar_one_or_none()
            if not product:
                raise EntityNotFoundError("Product", item_data.product_id)
            if not product.is_available:
                raise ConflictError(f"Product '{product.name}' is currently unavailable")

            # Concurrency Defense: Atomic conditional stock deduction
            stock_update_stmt = (
                update(Stock)
                .where(Stock.product_id == product.id, Stock.current_stock >= item_data.quantity)
                .values(current_stock=Stock.current_stock - item_data.quantity)
            )
            stock_res = await self.db.execute(stock_update_stmt)
            if stock_res.rowcount == 0:
                current_stock_res = await self.db.execute(
                    select(Stock.current_stock).where(Stock.product_id == product.id)
                )
                avail = current_stock_res.scalar_one_or_none() or 0
                raise InsufficientStockError(product.name, avail, item_data.quantity)

            # Calculate price snapshot
            subtotal = product.price * item_data.quantity
            total_amount += subtotal

            item_inst = getattr(item_data, "special_instructions", None)
            prep_mins = getattr(product, "prep_time_minutes", 5) or 5
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                item_name=product.name,
                unit_price=product.price,
                quantity=item_data.quantity,
                subtotal=subtotal,
                round_number=1,
                station=product.station,
                special_instructions=item_inst,
                prep_time_minutes=prep_mins
            )
            self.db.add(order_item)

            if product.station not in station_items_map:
                station_items_map[product.station] = []
            station_items_map[product.station].append({
                "product_id": product.id,
                "item_name": product.name,
                "quantity": item_data.quantity,
                "notes": item_inst,
                "special_instructions": item_inst
            })

        order.total_amount = total_amount
        await self.db.flush()

        # Generate KDS tickets by station
        for station, items in station_items_map.items():
            ticket = KitchenTicket(
                order_id=order.id,
                round_number=1,
                station=station,
                status=TicketStatus.NEW.value,
                ticket_items=items
            )
            self.db.add(ticket)

        if auto_commit:
            await self.db.commit()
            await self.db.refresh(order)
            await self.db.refresh(order, attribute_names=["items", "voucher", "status_history"])

        return order

    async def advance_order_status(self, order_id: int, target_status: str, changed_by_user_id: Optional[int] = None) -> Order:
        """
        Enforces canonical lifecycle state machine:
        PENDING -> CONFIRMED -> PREPARING -> COOKING -> READY -> PICKED_UP
        """
        order = await self.get_order_by_id(order_id)
        old_status = order.status

        # If already at target status, return idempotently
        if old_status == target_status:
            return order

        allowed_transitions = {
            OrderStatus.PENDING.value: [OrderStatus.CONFIRMED.value, OrderStatus.ACCEPTED.value, OrderStatus.CANCELLED.value],
            OrderStatus.NEW.value: [OrderStatus.CONFIRMED.value, OrderStatus.ACCEPTED.value, OrderStatus.PREPARING.value, OrderStatus.CANCELLED.value],
            OrderStatus.ACCEPTED.value: [OrderStatus.CONFIRMED.value, OrderStatus.PREPARING.value, OrderStatus.CANCELLED.value],
            OrderStatus.CONFIRMED.value: [OrderStatus.PREPARING.value, OrderStatus.CANCELLED.value],
            OrderStatus.PREPARING.value: [OrderStatus.COOKING.value, OrderStatus.READY.value, OrderStatus.CANCELLED.value],
            OrderStatus.COOKING.value: [OrderStatus.READY.value, OrderStatus.CANCELLED.value],
            OrderStatus.READY.value: [OrderStatus.PICKED_UP.value, OrderStatus.SERVED.value, OrderStatus.COMPLETED.value],
            OrderStatus.SERVED.value: [OrderStatus.PICKED_UP.value, OrderStatus.COMPLETED.value],
        }

        valid_targets = allowed_transitions.get(old_status, [])
        if target_status not in valid_targets and target_status != OrderStatus.CANCELLED.value:
            raise DomainException(
                f"Invalid order transition from '{old_status}' to '{target_status}'",
                status_code=422
            )

        order.status = target_status

        # If Chef confirms order -> Generate Voucher atomically!
        if target_status in [OrderStatus.CONFIRMED.value, OrderStatus.PREPARING.value]:
            if not order.confirmed_at:
                order.confirmed_at = datetime.now(timezone.utc)
                order.confirmed_by = changed_by_user_id
                order.confirmed_total = order.total_amount

            # Check if voucher exists; if not, create idempotent voucher
            v_res = await self.db.execute(select(OrderVoucher).where(OrderVoucher.order_id == order.id))
            if not v_res.scalar_one_or_none():
                voucher = OrderVoucher(
                    order_id=order.id,
                    voucher_number=f"VCH-{order.order_number}"
                )
                self.db.add(voucher)

        # Record Status History
        history = OrderStatusHistory(
            order_id=order.id,
            previous_status=old_status,
            new_status=target_status,
            changed_by=changed_by_user_id
        )
        self.db.add(history)

        # Synchronize linked kitchen tickets with order workflow
        status_map = {
            OrderStatus.CONFIRMED.value: TicketStatus.ACCEPTED.value,
            OrderStatus.PREPARING.value: TicketStatus.PREPARING.value,
            OrderStatus.COOKING.value: TicketStatus.COOKING.value,
            OrderStatus.READY.value: TicketStatus.READY.value,
            OrderStatus.PICKED_UP.value: TicketStatus.SERVED.value,
            OrderStatus.SERVED.value: TicketStatus.SERVED.value,
            OrderStatus.CANCELLED.value: TicketStatus.CANCELLED.value,
        }
        ticket_target = status_map.get(target_status)
        if ticket_target:
            for ticket in order.kitchen_tickets:
                if ticket.status != TicketStatus.CANCELLED.value:
                    ticket.status = ticket_target

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history"])
        return order

    async def accept_order_by_chef(self, order_id: int, chef_user_id: Optional[int] = None) -> Order:
        """
        Chef Action 1: Accept Order.
        - Validates order is PENDING (or NEW). Idempotent if already in PREPARING or beyond.
        - Confirms the order and creates Order Confirmation Voucher.
        - Automatically transitions order into PREPARING.
        - Calculates preparation_due_at based on the longest item preparation duration in the order.
        - Persists timing metadata: confirmed_at, preparing_at, preparation_duration_seconds, preparation_due_at.
        - Synchronizes linked kitchen tickets to PREPARING.
        - Records status history for both CONFIRMED and PREPARING.
        """
        order = await self.get_order_by_id(order_id)
        
        # Idempotency check: if already accepted/preparing/cooking/ready, return existing
        if order.status in [
            OrderStatus.PREPARING.value,
            OrderStatus.COOKING.value,
            OrderStatus.READY.value,
            OrderStatus.PICKED_UP.value,
            OrderStatus.SERVED.value,
            OrderStatus.COMPLETED.value
        ]:
            return order

        if order.status not in [OrderStatus.PENDING.value, OrderStatus.NEW.value, OrderStatus.CONFIRMED.value, OrderStatus.ACCEPTED.value]:
            raise DomainException(
                f"Cannot accept order #{order.id} in current status '{order.status}'",
                status_code=422
            )

        now_utc = datetime.now(timezone.utc)
        old_status = order.status

        # 1. Confirm order & generate voucher
        if not order.confirmed_at:
            order.confirmed_at = now_utc
            order.confirmed_by = chef_user_id
            order.confirmed_total = order.total_amount

        v_res = await self.db.execute(select(OrderVoucher).where(OrderVoucher.order_id == order.id))
        if not v_res.scalar_one_or_none():
            voucher = OrderVoucher(
                order_id=order.id,
                voucher_number=f"VCH-{order.order_number}"
            )
            self.db.add(voucher)

        # 2. Snapshot preparation duration (longest item in the order)
        item_prep_mins = [getattr(it, "prep_time_minutes", 5) or 5 for it in order.items]
        longest_prep_mins = max(item_prep_mins) if item_prep_mins else 5
        duration_seconds = longest_prep_mins * 60

        # 3. Automatic transition into PREPARING
        order.status = OrderStatus.PREPARING.value
        order.preparing_at = now_utc
        order.preparation_duration_seconds = duration_seconds
        order.preparation_due_at = now_utc + timedelta(seconds=duration_seconds)

        # 4. Record Status History: Confirmed (Chef) and Preparing (System automatic)
        hist_confirmed = OrderStatusHistory(
            order_id=order.id,
            previous_status=old_status,
            new_status=OrderStatus.CONFIRMED.value,
            changed_by=chef_user_id,
            is_system=False,
            actor_type="user",
            notes="Chef accepted order and confirmed voucher",
            changed_timestamp=now_utc
        )
        self.db.add(hist_confirmed)

        hist_preparing = OrderStatusHistory(
            order_id=order.id,
            previous_status=OrderStatus.CONFIRMED.value,
            new_status=OrderStatus.PREPARING.value,
            changed_by=chef_user_id,
            is_system=True,
            actor_type="system",
            notes=f"Auto-transitioned to preparing. Est. prep time: {longest_prep_mins}m ({duration_seconds}s)",
            changed_timestamp=now_utc
        )
        self.db.add(hist_preparing)

        # 5. Synchronize linked kitchen tickets
        for ticket in order.kitchen_tickets:
            if ticket.status != TicketStatus.CANCELLED.value:
                ticket.status = TicketStatus.PREPARING.value

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history", "kitchen_tickets"])
        return order

    async def process_overdue_preparation_orders(self) -> int:
        """
        Reliable backend background worker task:
        Evaluates active orders in PREPARING status whose preparation_due_at timestamp has passed.
        Transitions them to COOKING automatically with zero race conditions.
        Recoverable across backend restarts.
        """
        now_utc = datetime.now(timezone.utc)
        stmt = (
            select(Order)
            .where(
                and_(
                    Order.status == OrderStatus.PREPARING.value,
                    Order.preparation_due_at.isnot(None),
                    Order.preparation_due_at <= now_utc
                )
            )
        )
        res = await self.db.execute(stmt)
        overdue_orders = list(res.scalars().all())
        updated_count = 0

        for order in overdue_orders:
            # Atomic conditional update prevents double transition across concurrent workers
            upd_stmt = (
                update(Order)
                .where(
                    and_(
                        Order.id == order.id,
                        Order.status == OrderStatus.PREPARING.value
                    )
                )
                .values(
                    status=OrderStatus.COOKING.value,
                    cooking_at=now_utc,
                    updated_at=now_utc
                )
            )
            upd_res = await self.db.execute(upd_stmt)
            if upd_res.rowcount > 0:
                updated_count += 1
                history = OrderStatusHistory(
                    order_id=order.id,
                    previous_status=OrderStatus.PREPARING.value,
                    new_status=OrderStatus.COOKING.value,
                    changed_by=None,
                    is_system=True,
                    actor_type="system",
                    notes="Auto-transitioned to cooking: preparation duration elapsed",
                    changed_timestamp=now_utc
                )
                self.db.add(history)

                # Synchronize kitchen tickets
                ticket_upd = (
                    update(KitchenTicket)
                    .where(
                        and_(
                            KitchenTicket.order_id == order.id,
                            KitchenTicket.status != TicketStatus.CANCELLED.value
                        )
                    )
                    .values(
                        status=TicketStatus.COOKING.value,
                        updated_at=now_utc
                    )
                )
                await self.db.execute(ticket_upd)

        if updated_count > 0:
            await self.db.commit()

        return updated_count

    async def mark_order_ready_by_chef(self, order_id: int, chef_user_id: Optional[int] = None) -> Order:
        """
        Chef Action 2: Mark as Ready.
        Validates order is eligible (in PREPARING or COOKING).
        Allows early completion before the estimated timer expires.
        Records ready_at and transitions to READY.
        """
        order = await self.get_order_by_id(order_id)
        if order.status == OrderStatus.READY.value:
            return order

        if order.status not in [OrderStatus.PREPARING.value, OrderStatus.COOKING.value, OrderStatus.CONFIRMED.value]:
            raise DomainException(
                f"Cannot mark order #{order.id} as ready from current status '{order.status}'",
                status_code=422
            )

        now_utc = datetime.now(timezone.utc)
        old_status = order.status
        order.status = OrderStatus.READY.value
        order.ready_at = now_utc

        history = OrderStatusHistory(
            order_id=order.id,
            previous_status=old_status,
            new_status=OrderStatus.READY.value,
            changed_by=chef_user_id,
            is_system=False,
            actor_type="user",
            notes="Chef marked order as ready for pickup",
            changed_timestamp=now_utc
        )
        self.db.add(history)

        for ticket in order.kitchen_tickets:
            if ticket.status != TicketStatus.CANCELLED.value:
                ticket.status = TicketStatus.READY.value

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history", "kitchen_tickets"])
        return order

    async def confirm_order_pickup(self, order_id: int, user_id: Optional[int] = None) -> Order:
        """
        Customer Handover: Confirm Pickup.
        Validates order is currently READY.
        Transitions order to PICKED_UP and records picked_up_at.
        """
        order = await self.get_order_by_id(order_id)
        if order.status == OrderStatus.PICKED_UP.value:
            return order

        if order.status != OrderStatus.READY.value:
            raise DomainException(
                f"Cannot confirm pickup for order #{order.id} because it is in status '{order.status}' (must be 'ready')",
                status_code=422
            )

        now_utc = datetime.now(timezone.utc)
        old_status = order.status
        order.status = OrderStatus.PICKED_UP.value
        order.picked_up_at = now_utc

        history = OrderStatusHistory(
            order_id=order.id,
            previous_status=old_status,
            new_status=OrderStatus.PICKED_UP.value,
            changed_by=user_id,
            is_system=False,
            actor_type="user",
            notes="Customer pickup confirmed at the counter",
            changed_timestamp=now_utc
        )
        self.db.add(history)

        for ticket in order.kitchen_tickets:
            if ticket.status != TicketStatus.CANCELLED.value:
                ticket.status = TicketStatus.SERVED.value

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history", "kitchen_tickets"])
        return order

    async def get_voucher_data(self, order_id: int) -> OrderVoucherResponse:
        order = await self.get_order_by_id(order_id)
        
        # Ensure voucher exists if order is confirmed or active
        v_res = await self.db.execute(select(OrderVoucher).where(OrderVoucher.order_id == order.id))
        voucher = v_res.scalar_one_or_none()
        if not voucher:
            if order.status in [OrderStatus.PENDING.value, OrderStatus.NEW.value]:
                raise DomainException("Order Confirmation Voucher is not available until the Chef confirms the order.", status_code=404)
            # Auto-create voucher if confirmed/active
            voucher = OrderVoucher(
                order_id=order.id,
                voucher_number=f"VCH-{order.order_number}"
            )
            self.db.add(voucher)
            if not order.confirmed_at:
                order.confirmed_at = datetime.now(timezone.utc)
                order.confirmed_total = order.total_amount
            await self.db.commit()
            await self.db.refresh(voucher)

        subtotal = order.total_amount
        tax = subtotal * Decimal("0.05")
        service_charge = subtotal * Decimal("0.10")
        discount = Decimal("0.00")
        total_amount = subtotal + tax + service_charge

        items_detail = [
            OrderVoucherItemDetail(
                item_name=item.item_name,
                quantity=item.quantity,
                unit_price=format_mmk(item.unit_price),
                subtotal=format_mmk(item.subtotal)
            )
            for item in order.items
        ]

        return OrderVoucherResponse(
            order_id=order.id,
            voucher_number=voucher.voucher_number,
            voucher_code=voucher.voucher_number,
            order_number=order.order_number,
            restaurant_name="FLOW-SYS Bistro Yangon",
            table_number=order.table_number or "Dine-In",
            order_status="Confirmed",
            confirmed_at=order.confirmed_at or order.created_at,
            items=items_detail,
            items_snapshot=items_detail,
            subtotal=format_mmk(subtotal),
            tax=format_mmk(tax),
            service_charge=format_mmk(service_charge),
            discount=format_mmk(discount),
            total_amount=format_mmk(total_amount),
            currency="MMK",
            notice="Total amount only. This voucher confirms food preparation and is not a payment receipt."
        )

    async def generate_voucher_pdf(self, order_id: int) -> bytes:
        data = await self.get_voucher_data(order_id)
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'VoucherTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=colors.HexColor('#0f172a'),
            alignment=1
        )
        subtitle_style = ParagraphStyle(
            'VoucherSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=11,
            leading=14,
            textColor=colors.HexColor('#475569'),
            alignment=1
        )
        badge_style = ParagraphStyle(
            'VoucherBadge',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor('#e21b70'),
            alignment=1
        )
        regular_style = ParagraphStyle(
            'VoucherRegular',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#1e293b')
        )
        bold_style = ParagraphStyle(
            'VoucherBold',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor('#0f172a')
        )
        notice_style = ParagraphStyle(
            'VoucherNotice',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor('#64748b'),
            alignment=1
        )

        elements = []
        elements.append(Paragraph("FLOW-SYS BISTRO", title_style))
        elements.append(Paragraph("12 Inya Road, Yangon City • Tel: +95 9 123 4567", subtitle_style))
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("[ ORDER CONFIRMATION VOUCHER ]", badge_style))
        elements.append(Spacer(1, 15))

        # Order & Table Meta Table
        date_str = data.confirmed_at.strftime('%d-%b-%Y %I:%M %p') if data.confirmed_at else "Now"
        meta_data = [
            [Paragraph(f"<b>Order No:</b> {data.order_number}", regular_style), Paragraph(f"<b>Date:</b> {date_str}", regular_style)],
            [Paragraph(f"<b>Table:</b> {data.table_number}", regular_style), Paragraph(f"<b>Voucher No:</b> {data.voucher_number}", regular_style)]
        ]
        meta_table = Table(meta_data, colWidths=[260, 260])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(meta_table)
        elements.append(Spacer(1, 15))

        # Itemized Table
        table_rows = [
            [Paragraph("<b>Item Description</b>", bold_style), Paragraph("<b>Qty</b>", bold_style), Paragraph("<b>Unit Price</b>", bold_style), Paragraph("<b>Subtotal</b>", bold_style)]
        ]
        for item in data.items:
            table_rows.append([
                Paragraph(item.item_name, regular_style),
                Paragraph(str(item.quantity), regular_style),
                Paragraph(item.unit_price, regular_style),
                Paragraph(item.subtotal, regular_style),
            ])

        item_table = Table(table_rows, colWidths=[240, 50, 115, 115])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1f242e')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ]))
        elements.append(item_table)
        elements.append(Spacer(1, 10))

        # Financial Summary Table (Total Amount Only)
        summary_data = [
            [Paragraph("Items Subtotal:", regular_style), Paragraph(data.subtotal, regular_style)],
            [Paragraph("Commercial Tax (5%):", regular_style), Paragraph(data.tax, regular_style)],
            [Paragraph("Service Charge (10%):", regular_style), Paragraph(data.service_charge, regular_style)],
            [Paragraph("<b>TOTAL AMOUNT:</b>", bold_style), Paragraph(f"<b>{data.total_amount}</b>", bold_style)],
        ]
        summary_table = Table(summary_data, colWidths=[390, 130])
        summary_table.setStyle(TableStyle([
            ('ALIGN', (1,0), (1,-1), 'RIGHT'),
            ('LINEABOVE', (0,-1), (-1,-1), 1, colors.HexColor('#e21b70')),
            ('PADDING', (0,0), (-1,-1), 4),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 20))

        elements.append(Paragraph("* Note: This is an Order Confirmation Voucher, NOT a payment receipt.", notice_style))
        elements.append(Paragraph("Please retain this voucher for collection at the counter when food is ready.", notice_style))
        elements.append(Spacer(1, 8))
        elements.append(Paragraph("Thank you for dining with FLOW-SYS Bistro!", badge_style))

        doc.build(elements)
        return buffer.getvalue()

    async def add_round(self, order_id: int, data: AddRoundRequest) -> Order:
        order = await self.get_order_by_id(order_id)
        if order.status in [OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value, OrderStatus.PICKED_UP.value]:
            raise ConflictError(f"Cannot add round to order with status '{order.status}'")

        next_round = order.current_round + 1
        order.current_round = next_round
        
        round_subtotal = Decimal("0.00")
        station_items_map: Dict[str, List[dict]] = {}

        for item_data in data.items:
            product_res = await self.db.execute(
                select(Product).where(Product.id == item_data.product_id)
            )
            product = product_res.scalar_one_or_none()
            if not product or not product.is_available:
                raise ConflictError(f"Product ID {item_data.product_id} is unavailable")

            # Concurrency Defense: Atomic conditional stock deduction
            stock_update_stmt = (
                update(Stock)
                .where(Stock.product_id == product.id, Stock.current_stock >= item_data.quantity)
                .values(current_stock=Stock.current_stock - item_data.quantity)
            )
            stock_res = await self.db.execute(stock_update_stmt)
            if stock_res.rowcount == 0:
                current_stock_res = await self.db.execute(
                    select(Stock.current_stock).where(Stock.product_id == product.id)
                )
                avail = current_stock_res.scalar_one_or_none() or 0
                raise InsufficientStockError(product.name, avail, item_data.quantity)

            subtotal = product.price * item_data.quantity
            round_subtotal += subtotal

            item_inst = getattr(item_data, "special_instructions", None)
            prep_mins = getattr(product, "prep_time_minutes", 5) or 5
            order_item = OrderItem(
                order_id=order.id,
                product_id=product.id,
                item_name=product.name,
                unit_price=product.price,
                quantity=item_data.quantity,
                subtotal=subtotal,
                round_number=next_round,
                station=product.station,
                special_instructions=item_inst,
                prep_time_minutes=prep_mins
            )
            self.db.add(order_item)

            if product.station not in station_items_map:
                station_items_map[product.station] = []
            station_items_map[product.station].append({
                "product_id": product.id,
                "item_name": product.name,
                "quantity": item_data.quantity,
                "notes": item_inst,
                "special_instructions": item_inst
            })

        order.total_amount += round_subtotal
        await self.db.flush()

        for station, items in station_items_map.items():
            ticket = KitchenTicket(
                order_id=order.id,
                round_number=next_round,
                station=station,
                status=TicketStatus.NEW.value,
                ticket_items=items
            )
            self.db.add(ticket)

        await self.db.commit()
        await self.db.refresh(order)
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history"])
        return order

    async def update_order(self, order_id: int, data: OrderUpdate) -> Order:
        order = await self.get_order_by_id(order_id)
        if data.status is not None:
            order.status = data.status.value
        if data.table_number is not None:
            order.table_number = data.table_number
        if data.delivery_address is not None:
            order.delivery_address = data.delivery_address
        if data.special_instructions is not None:
            order.special_instructions = data.special_instructions

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "voucher", "status_history"])
        return order

    async def cancel_order(self, order_id: int) -> Order:
        order = await self.get_order_by_id(order_id)
        if order.status == OrderStatus.CANCELLED.value:
            return order
        if order.status in [OrderStatus.COMPLETED.value, OrderStatus.PICKED_UP.value]:
            raise ConflictError("Cannot cancel an order that has already been completed or picked up")

        # Restore stock for all items
        for item in order.items:
            await self.db.execute(
                update(Stock)
                .where(Stock.product_id == item.product_id)
                .values(current_stock=Stock.current_stock + item.quantity)
            )

        old_status = order.status
        order.status = OrderStatus.CANCELLED.value

        history = OrderStatusHistory(
            order_id=order.id,
            previous_status=old_status,
            new_status=OrderStatus.CANCELLED.value,
            changed_by=None
        )
        self.db.add(history)

        # Cancel all kitchen tickets
        for ticket in order.kitchen_tickets:
            ticket.status = TicketStatus.CANCELLED.value

        # Cancel or refund associated payments
        for payment in order.payments:
            if payment.status == PaymentStatus.SUCCESSFUL.value:
                payment.status = PaymentStatus.REFUNDED.value
            elif payment.status == PaymentStatus.PENDING.value:
                payment.status = PaymentStatus.CANCELLED.value

        await self.db.commit()
        await self.db.refresh(order, attribute_names=["items", "payments", "kitchen_tickets", "voucher", "status_history"])
        return order

    async def get_admin_analytics(self, date_range: str = "7d") -> dict:
        from datetime import timedelta
        from sqlalchemy import func
        now = datetime.now(timezone.utc)
        start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

        valid_statuses = [
            OrderStatus.CONFIRMED.value,
            OrderStatus.PREPARING.value,
            OrderStatus.COOKING.value,
            OrderStatus.READY.value,
            OrderStatus.SERVED.value,
            OrderStatus.PICKED_UP.value,
            OrderStatus.COMPLETED.value,
            "accepted"
        ]

        # 1. Today's metrics
        sales_today_res = await self.db.execute(
            select(func.coalesce(func.sum(Order.total_amount), 0))
            .where(
                and_(
                    Order.created_at >= start_of_today,
                    Order.status.in_(valid_statuses)
                )
            )
        )
        today_sales = float(sales_today_res.scalar() or 0)

        orders_today_res = await self.db.execute(
            select(func.count(Order.id))
            .where(Order.created_at >= start_of_today)
        )
        today_orders_count = orders_today_res.scalar() or 0

        completed_res = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.created_at >= start_of_today,
                    Order.status.in_([OrderStatus.READY.value, OrderStatus.SERVED.value, OrderStatus.PICKED_UP.value, OrderStatus.COMPLETED.value])
                )
            )
        )
        completed_orders_count = completed_res.scalar() or 0

        pending_res = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.created_at >= start_of_today,
                    Order.status.in_([OrderStatus.PENDING.value, OrderStatus.CONFIRMED.value, OrderStatus.PREPARING.value, OrderStatus.COOKING.value, "accepted", "paid"])
                )
            )
        )
        pending_orders_count = pending_res.scalar() or 0

        cancelled_res = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.created_at >= start_of_today,
                    Order.status == OrderStatus.CANCELLED.value
                )
            )
        )
        cancelled_orders_count = cancelled_res.scalar() or 0

        # Calculate AOV
        valid_orders_today_res = await self.db.execute(
            select(func.count(Order.id))
            .where(
                and_(
                    Order.created_at >= start_of_today,
                    Order.status.in_(valid_statuses)
                )
            )
        )
        valid_orders_today = valid_orders_today_res.scalar() or 0
        aov = round(today_sales / valid_orders_today, 2) if valid_orders_today > 0 else 0.0

        # 2. Tables Utilization
        total_tables_res = await self.db.execute(select(func.count(RestaurantTable.id)))
        total_tables = total_tables_res.scalar() or 0

        active_tables_res = await self.db.execute(
            select(func.count(func.distinct(Order.table_id)))
            .where(Order.status.notin_([OrderStatus.CANCELLED.value, OrderStatus.PICKED_UP.value, OrderStatus.COMPLETED.value]))
        )
        active_tables = active_tables_res.scalar() or 0

        # 3. Best-Selling / Most Ordered Food Items (scoped to requested date_range)
        best_where_clauses = [Order.status.in_(valid_statuses)]
        if date_range == "today":
            best_where_clauses.append(Order.created_at >= start_of_today)
        elif date_range == "7d":
            best_where_clauses.append(Order.created_at >= (now - timedelta(days=7)))
        elif date_range == "30d":
            best_where_clauses.append(Order.created_at >= (now - timedelta(days=30)))

        best_stmt = (
            select(
                OrderItem.item_name,
                func.sum(OrderItem.quantity).label("total_quantity"),
                func.sum(OrderItem.subtotal).label("total_revenue"),
                func.count(func.distinct(Order.id)).label("order_count")
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(and_(*best_where_clauses))
            .group_by(OrderItem.item_name)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(10)
        )
        best_res = await self.db.execute(best_stmt)
        best_rows = best_res.all()

        total_best_qty = sum(int(row[1]) for row in best_rows) if best_rows else 0
        best_sellers = [
            {
                "item_name": row[0],
                "total_quantity": int(row[1]),
                "total_revenue": float(row[2]),
                "order_count": int(row[3]) if len(row) > 3 else int(row[1]),
                "percentage": round((int(row[1]) / total_best_qty) * 100, 1) if total_best_qty > 0 else 0.0
            }
            for row in best_rows
        ]

        # 4. Daily sales & order volume timeline
        timeline = []
        days_to_check = 7 if date_range != "30d" else 30
        for i in range(days_to_check - 1, -1, -1):
            day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc) - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            day_str = day_start.strftime("%b %d")

            d_sales_res = await self.db.execute(
                select(func.coalesce(func.sum(Order.total_amount), 0))
                .where(
                    and_(
                        Order.created_at >= day_start,
                        Order.created_at < day_end,
                        Order.status.in_(valid_statuses)
                    )
                )
            )
            d_sales = float(d_sales_res.scalar() or 0)

            d_count_res = await self.db.execute(
                select(func.count(Order.id))
                .where(
                    and_(
                        Order.created_at >= day_start,
                        Order.created_at < day_end
                    )
                )
            )
            d_count = d_count_res.scalar() or 0

            d_completed_res = await self.db.execute(
                select(func.count(Order.id))
                .where(
                    and_(
                        Order.created_at >= day_start,
                        Order.created_at < day_end,
                        Order.status.in_([OrderStatus.READY.value, OrderStatus.SERVED.value, OrderStatus.PICKED_UP.value, OrderStatus.COMPLETED.value])
                    )
                )
            )
            d_completed = d_completed_res.scalar() or 0

            d_cancelled_res = await self.db.execute(
                select(func.count(Order.id))
                .where(
                    and_(
                        Order.created_at >= day_start,
                        Order.created_at < day_end,
                        Order.status == OrderStatus.CANCELLED.value
                    )
                )
            )
            d_cancelled = d_cancelled_res.scalar() or 0

            timeline.append({
                "date": day_str,
                "sales": d_sales,
                "orders": d_count,
                "completed_orders": d_completed,
                "cancelled_orders": d_cancelled
            })

        return {
            "currency": "MMK",
            "date_range": date_range,
            "today_sales": today_sales,
            "today_orders_count": today_orders_count,
            "completed_orders_count": completed_orders_count,
            "pending_orders_count": pending_orders_count,
            "cancelled_orders_count": cancelled_orders_count,
            "average_order_value": aov,
            "active_tables_count": active_tables,
            "total_tables_count": total_tables,
            "best_sellers": best_sellers,
            "daily_sales_timeline": timeline
        }
