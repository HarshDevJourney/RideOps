from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import List, Optional

from app.config import AS_OF


@dataclass
class Ticket:
    """One support ticket. Plain data plus a few small helpers."""
    ticket_id: str
    created_at: datetime
    client_id: str
    client_name: str
    category: str
    priority: str
    description: str
    assigned_agent: str = ""
    escalated: bool = False
    eng_handoffs: int = 0
    eng_outcome: Optional[str] = None
    status: str = "Open - with L1"
    final_closed_at: Optional[datetime] = None
    reopen_count: int = 0
    csat_score: Optional[float] = None
    channel: str = ""
    info_provided: List[str] = field(default_factory=list)  # filled only by the manual "Try a ticket" form

    def is_open(self) -> bool:
        return self.status.startswith("Open")

    def hours_to_close(self) -> Optional[float]:
        if self.final_closed_at is None:
            return None
        return (self.final_closed_at - self.created_at).total_seconds() / 3600

    def age_days(self) -> int:
        return max(0, (AS_OF - self.created_at).days)

    def masked(self) -> "Ticket":
        """What L1 knew BEFORE escalating. The backtester uses this so no future facts leak into a prediction."""
        return replace(self, escalated=False, eng_handoffs=0, eng_outcome=None, reopen_count=0,
                       final_closed_at=None, status="Open - with L1", csat_score=None)
