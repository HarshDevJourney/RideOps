from typing import List

from app import config
from app.checks.base import BaseCheck
from app.models.ticket import Ticket
from app.tags import (BOUNCING, COLLECT_INFO_FIRST, CONFIG, CONFIG_CHECK, HOW_TO, HOWTO_O, INSUFFICIENT,
                      LACK_OF_INFO, NOT_REPRODUCIBLE, NOTREPRO_O)

_OUTCOME_TAG = {INSUFFICIENT: LACK_OF_INFO, CONFIG: CONFIG_CHECK, HOWTO_O: HOW_TO, NOTREPRO_O: NOT_REPRODUCIBLE}


class EscalationGate(BaseCheck):
    """Stops avoidable escalations: what was engineering missing, and what should L1 collect first?"""
    name = "Escalation gate"

    def __init__(self):
        self.required_fields = dict(config.REQUIRED_INFO)
        self.info_gap = {}   # category -> {"rate": share of escalations returned for info/config, "n": escalations}

    def learn(self, baselines: dict) -> None:
        self.info_gap = baselines["info_gap"]

    def missing_info(self, ticket: Ticket) -> List[str]:
        needed = self.required_fields.get(ticket.category, [])
        return [f for f in needed if f not in ticket.info_provided]

    def _category_often_returned(self, category: str) -> bool:
        g = self.info_gap.get(category)
        return bool(g) and g["n"] >= config.GATE_MIN_EVIDENCE and g["rate"] >= config.GATE_INFO_GAP_RATE

    def run(self, ticket: Ticket) -> List[str]:
        tags = []
        if ticket.eng_outcome in _OUTCOME_TAG:
            tags.append(_OUTCOME_TAG[ticket.eng_outcome])
        elif not ticket.escalated and self._category_often_returned(ticket.category) and self.missing_info(ticket):
            tags.append(COLLECT_INFO_FIRST)
        if ticket.eng_handoffs >= config.BOUNCE_AT:
            tags.append(BOUNCING)
        return tags

    def evidence(self, ticket: Ticket) -> dict:
        g = self.info_gap.get(ticket.category, {})
        return {"missing_info": self.missing_info(ticket), "info_gap_rate": g.get("rate")}
