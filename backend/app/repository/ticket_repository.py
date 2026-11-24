from datetime import datetime, timedelta
from typing import List, Optional

import pandas as pd

from app import config
from app.models.ticket import Ticket
from app.tags import FIXED

_DATES = ["created_at", "first_response_at", "first_closed_at", "final_closed_at"]


def _none(v):
    return None if pd.isna(v) else v


def end_of_day(day) -> datetime:
    """A date means 'until the end of that day', so 30 Sep becomes 30 Sep 23:59."""
    d = pd.Timestamp(day).normalize()
    return (d + timedelta(hours=23, minutes=59)).to_pydatetime()


class TicketRepository:
    """The only class that reads the CSV. Everything else asks it for tickets or the table."""

    def __init__(self):
        self.df: pd.DataFrame = pd.DataFrame()
        self._tickets: List[Ticket] = []
        self._by_id = {}
        self.as_of: datetime = config.AS_OF
        self.as_of_is_manual = False
        self.latest_event: datetime = config.AS_OF    # end of the latest day on which anything happened to a ticket

    def load_csv(self, path, extra: Optional[pd.DataFrame] = None, as_of: Optional[str] = None) -> "TicketRepository":
        """Read the base CSV, then lay uploaded rows on top (a ticket ID in `extra` replaces the same ID in the base).

        `extra` holds text columns exactly as in the CSV. `as_of` is an optional date typed by the user; without it the
        data is taken to be pulled at the end of the latest day that appears in any timestamp."""
        raw = pd.read_csv(path, dtype=str)
        if extra is not None and len(extra):
            raw = pd.concat([raw, extra.reindex(columns=raw.columns)], ignore_index=True)
            raw = raw.drop_duplicates("ticket_id", keep="last").reset_index(drop=True)
        df = self._typed(raw)
        df["escalated"] = df["escalated_to_eng"].eq("Yes")
        df["avoidable"] = df["escalated"] & df["eng_outcome"].notna() & df["eng_outcome"].ne(FIXED)
        df["ttr_hours"] = (df["final_closed_at"] - df["created_at"]).dt.total_seconds() / 3600
        self.df = df
        latest = max(df[c].max() for c in _DATES if df[c].notna().any())
        self.as_of_is_manual = bool(as_of)
        self.latest_event = end_of_day(latest)
        self.as_of = end_of_day(as_of) if as_of else self.latest_event
        self._tickets = [self._to_ticket(r) for r in df.itertuples(index=False)]
        self._by_id = {t.ticket_id: t for t in self._tickets}
        return self

    @staticmethod
    def _typed(raw: pd.DataFrame) -> pd.DataFrame:
        df = raw.copy()
        for c in _DATES:
            df[c] = pd.to_datetime(df[c])
        for c in ("eng_handoffs", "reopen_count"):
            df[c] = pd.to_numeric(df[c]).fillna(0).astype(int)
        df["csat_score"] = pd.to_numeric(df["csat_score"])
        return df

    def _to_ticket(self, r) -> Ticket:
        closed = _none(r.final_closed_at)
        return Ticket(
            ticket_id=r.ticket_id, created_at=r.created_at.to_pydatetime(), client_id=r.client_id,
            client_name=r.client_name, category=r.category, priority=r.priority, description=r.description,
            assigned_agent=r.assigned_agent, escalated=bool(r.escalated), eng_handoffs=int(r.eng_handoffs),
            eng_outcome=_none(r.eng_outcome), status=r.status,
            final_closed_at=closed.to_pydatetime() if closed is not None else None,
            reopen_count=int(r.reopen_count), csat_score=_none(r.csat_score), channel=r.channel, as_of=self.as_of)

    # ---- the time window the data covers -------------------------------------------------------------------
    @property
    def first_day(self) -> datetime:
        return self.df.created_at.min().normalize().to_pydatetime()

    def backtest_window(self) -> dict:
        """Earliest and latest split date that leave data on both sides, and a sensible default
        (the start of the latest month: learn from the months before it, replay that month)."""
        lo = self.first_day + timedelta(days=config.BACKTEST_FIRST_SPLIT_DAYS)
        hi = pd.Timestamp(self.as_of).normalize().to_pydatetime() - timedelta(days=config.BACKTEST_LAST_SPLIT_DAYS)
        if hi < lo:
            hi = lo
        default = pd.Timestamp(self.as_of).replace(day=1).normalize()
        if default.to_pydatetime() > hi:
            default = (default - pd.offsets.MonthBegin(1)).normalize()
        default = min(max(default.to_pydatetime(), lo), hi)
        return {"min": lo.date().isoformat(), "max": hi.date().isoformat(), "default": default.date().isoformat()}

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
