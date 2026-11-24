from collections import Counter, defaultdict
from datetime import datetime
from typing import List, Optional

from app import config
from app.checks.known_issue_matcher import normalize
from app.models.ticket import Ticket
from app.repository.ticket_repository import TicketRepository
from app.tags import CONFIG, FIXED, INSUFFICIENT


class HistoryLearner:
    """Turns past tickets into the numbers the checks use. Learning = counting, no ML."""

    def __init__(self):
        self.baselines: dict = {}

    def fit(self, repo: TicketRepository, until: Optional[datetime] = None) -> dict:
        everything = repo.all()
        train = repo.before(until) if until else everything
        scale = len(train) / max(1, len(everything))
        self.baselines = {
            "train_size": len(train),
            "until": until.isoformat() if until else None,
            "known_issues": self.learn_issues(train, scale),
            "info_gap": self.learn_fields(train),
            "risk_table": self.learn_risk(train),
        }
        return self.baselines

    def apply_to(self, checks) -> None:
        for c in checks:
            c.learn(self.baselines)

    def learn_issues(self, train: List[Ticket], scale: float = 1.0) -> dict:
        """Repeated descriptions (numbers ignored) plus how their escalations ended."""
        min_repeats = max(3, round(config.MIN_REPEATS * scale))
        groups = defaultdict(list)
        for t in train:
            groups[normalize(t.description)].append(t)
        issues = {}
        for key, items in groups.items():
            if len(items) < min_repeats:
                continue
            esc = [t for t in items if t.escalated and t.eng_outcome]
            outcomes = Counter(t.eng_outcome for t in esc)
            n_esc = len(esc)
            issues[key] = {
                "example": Counter(t.description for t in items).most_common(1)[0][0],
                "category": Counter(t.category for t in items).most_common(1)[0][0],
                "count": len(items), "escalations": n_esc,
                "fixed_rate": round(outcomes[FIXED] / n_esc, 2) if n_esc else None,
                "avoidable_rate": round((n_esc - outcomes[FIXED]) / n_esc, 2) if n_esc else None,
                "outcomes": dict(outcomes),
            }
        return issues

    def learn_fields(self, train: List[Ticket]) -> dict:
        """Per category: how often did escalations come back for missing info or config?"""
        per = defaultdict(lambda: [0, 0])
        for t in train:
            if t.escalated and t.eng_outcome:
                per[t.category][0] += 1
                per[t.category][1] += t.eng_outcome in (INSUFFICIENT, CONFIG)
        return {c: {"n": n, "rate": round(gap / n, 2)} for c, (n, gap) in per.items()}

    def learn_risk(self, train: List[Ticket]) -> dict:
        def rates(key):
            per = defaultdict(lambda: [0, 0])
            for t in train:
                per[key(t)][0] += 1
                per[key(t)][1] += t.reopen_count >= 1
            return {k: round(r / n, 3) for k, (n, r) in per.items()}
        overall = sum(t.reopen_count >= 1 for t in train) / max(1, len(train))
        return {"category": rates(lambda t: t.category), "agent": rates(lambda t: t.assigned_agent),
                "overall": round(overall, 3)}
