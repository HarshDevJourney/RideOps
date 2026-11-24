from dataclasses import dataclass, field
from typing import List


@dataclass
class Verdict:
    """What the agent sees for one ticket: tags, one recommended action, and why."""
    ticket_id: str
    tags: List[str]
    action: str
    reason: str
    risk: float = 0.0
    hold_escalation: bool = False   # True = advise the agent to check first before escalating
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {"ticket_id": self.ticket_id, "tags": self.tags, "action": self.action, "reason": self.reason,
                "risk": round(self.risk, 2), "hold_escalation": self.hold_escalation, "details": self.details}
