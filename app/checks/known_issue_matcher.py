import difflib
import re
from typing import List, Optional

from app.checks.base import BaseCheck
from app.models.ticket import Ticket
from app.tags import DUPLICATE, DUPLICATE_O, SIMILAR_TO_HISTORY


def normalize(text: str) -> str:
    """'Roster shows duplicate entries for 17 employees' and '...for 4 employees' are the same issue."""
    return re.sub(r"\d+", "#", text.lower()).strip()


class KnownIssueMatcher(BaseCheck):
    """Finds repeated issues in history and reports how those earlier escalations ended."""
    name = "Known-issue matcher"

    def __init__(self):
        self.known_issues = {}   # normalized description -> stats learned by HistoryLearner

    def learn(self, baselines: dict) -> None:
        self.known_issues = baselines["known_issues"]

    def find_match(self, ticket: Ticket) -> Optional[dict]:
        key = normalize(ticket.description)
        if key in self.known_issues:
            return {**self.known_issues[key], "similarity": 1.0}
        best, best_sim = None, 0.0
        for k, stats in self.known_issues.items():
            if ticket.category and stats["category"] != ticket.category:
                continue
            sim = difflib.SequenceMatcher(None, key, k).ratio()
            if sim > best_sim:
                best, best_sim = stats, sim
        return {**best, "similarity": round(best_sim, 2)} if best and best_sim >= 0.75 else None

    def run(self, ticket: Ticket) -> List[str]:
        tags = []
        if ticket.eng_outcome == DUPLICATE_O:
            tags.append(DUPLICATE)
        if self.find_match(ticket):
            tags.append(SIMILAR_TO_HISTORY)
        return tags

    def evidence(self, ticket: Ticket) -> dict:
        m = self.find_match(ticket)
        return {"similar": m} if m else {}
