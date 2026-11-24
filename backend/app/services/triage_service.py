from typing import List, Tuple

from app import config
from app.checks.base import BaseCheck
from app.models.ticket import Ticket
from app.models.verdict import Verdict
from app.tags import (BOUNCING, COLLECT_INFO_FIRST, CONFIG_CHECK, DUPLICATE, FIX_READY, HOW_TO, LACK_OF_INFO,
                      NOT_REPRODUCIBLE, P1, REOPEN_RISK, SIMILAR_TO_HISTORY)

_PRIORITY_RANK = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}


class TriageService:
    """Facade: the agent screen calls assess() and never talks to the individual checks."""

    def __init__(self, checks: List[BaseCheck]):
        self.checks = checks

    def assess(self, ticket: Ticket) -> Verdict:
        tags, evidence = [], {}
        for check in self.checks:
            tags += [t for t in check.run(ticket) if t not in tags]
            evidence.update(check.evidence(ticket))
        if ticket.priority == "P1":
            tags.insert(0, P1)
        hold = self._should_hold(ticket, tags, evidence)
        action = self._action(ticket, tags, evidence, hold)
        return Verdict(ticket.ticket_id, tags, action, self._reason(ticket, tags, evidence),
                       risk=evidence.get("risk", 0.0), hold_escalation=hold, details=evidence)

    def tag_queue(self, tickets: List[Ticket]) -> List[Tuple[Ticket, Verdict]]:
        rows = [(t, self.assess(t)) for t in tickets]
        rows.sort(key=lambda r: (_PRIORITY_RANK.get(r[0].priority, 9), -r[0].eng_handoffs, -r[0].age_days()))
        return rows

    @staticmethod
    def _should_hold(ticket: Ticket, tags: List[str], ev: dict) -> bool:
        """Advice to check before escalating. P1 is never held."""
        if ticket.priority == "P1" or ticket.escalated:
            return False
        sim = ev.get("similar")
        often_unfixed = bool(sim) and (sim["escalations"] >= config.FLAG_MIN_EVIDENCE
                                       and (sim["avoidable_rate"] or 0) >= config.FLAG_AVOIDABLE_RATE)
        return COLLECT_INFO_FIRST in tags or often_unfixed

    @staticmethod
    def _action(ticket: Ticket, tags: List[str], ev: dict, hold: bool) -> str:
        missing = ev.get("missing_info") or []
        if DUPLICATE in tags:
            action = "Link to the original issue, send the known workaround and close."
        elif FIX_READY in tags:
            action = "Engineering marked this fixed. Confirm with the client, then close."
        elif LACK_OF_INFO in tags:
            action = "Collect before resending: " + "; ".join(missing) + "." if missing else "Collect the missing details before resending."
        elif CONFIG_CHECK in tags:
            action = "Check the client's configuration first, then resend with what you found."
        elif HOW_TO in tags:
            action = "Reply with step-by-step guidance and close."
        elif NOT_REPRODUCIBLE in tags:
            action = "Ask for exact steps, time and a screenshot, then resend."
        elif hold and missing:
            action = "Collect before escalating: " + "; ".join(missing) + "."
        elif SIMILAR_TO_HISTORY in tags:
            action = "Check the similar earlier tickets and apply their workaround before escalating."
        else:
            action = "Continue L1 troubleshooting."
        if BOUNCING in tags:
            action += f" Bounced {ticket.eng_handoffs} times: ask the lead to own it."
        if REOPEN_RISK in tags and FIX_READY not in tags:
            action += " Use the closing checklist before you close."
        return action

    @staticmethod
    def _reason(ticket: Ticket, tags: List[str], ev: dict) -> str:
        parts = []
        if ticket.eng_outcome:
            parts.append(f"Engineering outcome: {ticket.eng_outcome}")
        if ticket.eng_handoffs:
            parts.append(f"{ticket.eng_handoffs} handoff" + ("s" if ticket.eng_handoffs > 1 else ""))
        sim = ev.get("similar")
        if sim:
            fixed = f", {round(sim['fixed_rate'] * 100)}% of escalations were fixed" if sim["fixed_rate"] is not None else ""
            parts.append(f"{sim['count']} similar earlier tickets{fixed}")
        if COLLECT_INFO_FIRST in tags and ev.get("info_gap_rate") is not None:
            parts.append(f"{round(ev['info_gap_rate'] * 100)}% of past escalations in this category came back for info or config")
        if ticket.priority == "P1":
            parts.append("P1 is never blocked, these checks are advice only")
        return "; ".join(parts) if parts else "No warning signs in the data."
