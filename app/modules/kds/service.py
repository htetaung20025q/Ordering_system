from typing import List, Optional, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.modules.kds.models import KitchenTicket
from app.modules.kds.schemas import KitchenTicketUpdate
from app.common.enums import TicketStatus, KitchenStation
from app.core.exceptions import EntityNotFoundError, InvalidStatusTransitionError

BUMP_TRANSITIONS = {
    TicketStatus.NEW.value: TicketStatus.PREPARING.value,
    TicketStatus.ACCEPTED.value: TicketStatus.PREPARING.value,
    TicketStatus.PREPARING.value: TicketStatus.COOKING.value,
    TicketStatus.COOKING.value: TicketStatus.READY.value,
    TicketStatus.READY.value: TicketStatus.SERVED.value,
}

class KDSService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_ticket_by_id(self, ticket_id: int) -> KitchenTicket:
        result = await self.db.execute(
            select(KitchenTicket)
            .options(selectinload(KitchenTicket.order))
            .where(KitchenTicket.id == ticket_id)
        )
        ticket = result.scalar_one_or_none()
        if not ticket:
            raise EntityNotFoundError("KitchenTicket", ticket_id)
        return ticket

    async def list_tickets(
        self,
        station: Optional[str] = None,
        status: Optional[str] = None,
        exclude_served: bool = False
    ) -> List[KitchenTicket]:
        stmt = select(KitchenTicket).options(selectinload(KitchenTicket.order))
        if station:
            stmt = stmt.where(KitchenTicket.station == station)
        if status:
            stmt = stmt.where(KitchenTicket.status == status)
        elif exclude_served:
            stmt = stmt.where(KitchenTicket.status.notin_([TicketStatus.SERVED.value, TicketStatus.CANCELLED.value]))
        stmt = stmt.order_by(KitchenTicket.created_at.asc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_ticket(self, ticket_id: int, data: KitchenTicketUpdate) -> KitchenTicket:
        ticket = await self.get_ticket_by_id(ticket_id)
        
        if data.bump:
            next_status = BUMP_TRANSITIONS.get(ticket.status)
            if not next_status:
                raise InvalidStatusTransitionError(ticket.status, "bump_next (already at final stage)")
            ticket.status = next_status
        elif data.status is not None:
            target_status = data.status.value if hasattr(data.status, "value") else str(data.status)
            ticket.status = target_status

        await self.db.commit()
        await self.db.refresh(ticket)
        return ticket

    async def delete_ticket(self, ticket_id: int) -> None:
        """Dismisses/deletes ticket from KDS display"""
        ticket = await self.get_ticket_by_id(ticket_id)
        await self.db.delete(ticket)
        await self.db.commit()

    async def create_tickets_for_order(
        self,
        order_id: int,
        round_number: int,
        station_items_map: Dict[str, List[dict]]
    ) -> List[KitchenTicket]:
        tickets = []
        for station, items in station_items_map.items():
            if not items:
                continue
            ticket = KitchenTicket(
                order_id=order_id,
                round_number=round_number,
                station=station,
                status=TicketStatus.NEW.value,
                ticket_items=items
            )
            self.db.add(ticket)
            tickets.append(ticket)
        await self.db.commit()
        for t in tickets:
            await self.db.refresh(t)
        return tickets

