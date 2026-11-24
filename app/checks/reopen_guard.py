from typing import List

from app import config
from app.checks.base import BaseCheck
from app.models.ticket import Ticket
from app.tags import FIX_READY, FIXED, REOPEN_RISK, REOPENED


class ReopenGuard(BaseCheck):
    """Protects against closing too early: scores reopen risk and supplies a closing checklist."""
    name = "Reopen guard"

    def __init__(self):
        self.risk_table = {"category": {}, "agent": {}, "overall": 0.1}

    def learn(self, baselines: dict) -> None:
        self.risk_table = baselines["risk_table"]

    def risk_score(self, ticket: Ticket) -> float:
        overall = self.risk_table["overall"]
        cat = self.risk_table["category"].get(ticket.category, overall)
        agent = self.risk_table["agent"].get(ticket.assigned_agent, overall)
        return min(0.95, (cat + agent) / 2 + 0.03 * ticket.eng_handoffs)

    def checklist(self, ticket: Ticket) -> List[str]:
        return config.CLOSING_CHECKLIST.get(ticket.category, []) + config.CLOSING_CHECKLIST["default"]

    def run(self, ticket: Ticket) -> List[str]:
        tags = []
        if ticket.reopen_count >= 1:
            tags.append(REOPENED)
        if ticket.is_open() and ticket.eng_outcome == FIXED:
            tags.append(FIX_READY)
        if ticket.is_open() and self.risk_score(ticket) >= config.REOPEN_RISK_FLAG:
            tags.append(REOPEN_RISK)
        return tags

    def evidence(self, ticket: Ticket) -> dict:
        return {"risk": round(self.risk_score(ticket), 2), "checklist": self.checklist(ticket)}
