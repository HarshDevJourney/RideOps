from datetime import datetime
from typing import List

import pandas as pd

from app.models.ticket import Ticket
from app.tags import FIXED

_DATES = ["created_at", "first_response_at", "first_closed_at", "final_closed_at"]


def _none(v):
    return None if pd.isna(v) else v


class TicketRepository:
    """The only class that reads the CSV. Everything else asks it for tickets or the table."""

    def __init__(self):
        self.df: pd.DataFrame = pd.DataFrame()
        self._tickets: List[Ticket] = []
        self._by_id = {}

    def load_csv(self, path) -> "TicketRepository":
        df = pd.read_csv(path, parse_dates=_DATES)
        df["escalated"] = df["escalated_to_eng"].eq("Yes")
        df["avoidable"] = df["escalated"] & df["eng_outcome"].notna() & df["eng_outcome"].ne(FIXED)
        df["ttr_hours"] = (df["final_closed_at"] - df["created_at"]).dt.total_seconds() / 3600
        self.df = df
        self._tickets = [self._to_ticket(r) for r in df.itertuples(index=False)]
        self._by_id = {t.ticket_id: t for t in self._tickets}
        return self

    @staticmethod
    def _to_ticket(r) -> Ticket:
        closed = _none(r.final_closed_at)
        return Ticket(
            ticket_id=r.ticket_id, created_at=r.created_at.to_pydatetime(), client_id=r.client_id,
            client_name=r.client_name, category=r.category, priority=r.priority, description=r.description,
            assigned_agent=r.assigned_agent, escalated=bool(r.escalated), eng_handoffs=int(r.eng_handoffs),
            eng_outcome=_none(r.eng_outcome), status=r.status,
            final_closed_at=closed.to_pydatetime() if closed is not None else None,
            reopen_count=int(r.reopen_count), csat_score=_none(r.csat_score), channel=r.channel)

    def all(self) -> List[Ticket]:
        return self._tickets

    def get(self, ticket_id: str) -> Ticket:
        return self._by_id[ticket_id]

    def open_queue(self) -> List[Ticket]:
        return [t for t in self._tickets if t.is_open()]

    def before(self, date: datetime) -> List[Ticket]:
        return [t for t in self._tickets if t.created_at < date]

    def on_or_after(self, date: datetime) -> List[Ticket]:
        return [t for t in self._tickets if t.created_at >= date]
