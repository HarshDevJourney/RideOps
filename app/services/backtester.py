from collections import Counter
from datetime import datetime

from app.checks.escalation_gate import EscalationGate
from app.checks.known_issue_matcher import KnownIssueMatcher
from app.checks.reopen_guard import ReopenGuard
from app.repository.ticket_repository import TicketRepository
from app.services.history_learner import HistoryLearner
from app.services.triage_service import TriageService
from app.tags import FIXED


class Backtester:
    """Learn from tickets BEFORE a date, then replay the escalations AFTER it as if the tool had existed."""

    def __init__(self, repo: TicketRepository):
        self.repo = repo

    def run(self, split_date: str) -> dict:
        split = datetime.fromisoformat(split_date)
        learner = HistoryLearner()
        checks = [EscalationGate(), KnownIssueMatcher(), ReopenGuard()]
        baselines = learner.fit(self.repo, until=split)
        learner.apply_to(checks)
        triage = TriageService(checks)

        test = [t for t in self.repo.on_or_after(split) if t.escalated]
        caught = wrong = flagged = avoidable = p1_skipped = 0
        caught_by, wrong_by = Counter(), Counter()
        for t in test:
            is_avoidable = t.eng_outcome != FIXED
            avoidable += is_avoidable
            p1_skipped += t.priority == "P1"
            verdict = triage.assess(t.masked())          # masked: no outcome, no handoffs, no reopens
            if verdict.hold_escalation:
                flagged += 1
                if is_avoidable:
                    caught += 1
                    caught_by[t.eng_outcome] += 1
                else:
                    wrong += 1
                    wrong_by[t.category] += 1
        n = len(test)
        base = avoidable / n if n else 0
        precision = caught / flagged if flagged else 0
        return {
            "split_date": split_date, "train_size": baselines["train_size"], "test_escalations": n,
            "avoidable_total": avoidable, "base_rate": round(base, 3), "flagged": flagged,
            "caught": caught, "wrongly_flagged": wrong, "missed": avoidable - caught,
            "precision": round(precision, 3), "recall": round(caught / avoidable, 3) if avoidable else 0,
            "lift": round(precision / base, 2) if base else 0, "p1_never_blocked": p1_skipped,
            "beats_chance": bool(base and precision / base >= 1.1),
            "caught_by_outcome": dict(caught_by), "wrongly_flagged_by_category": dict(wrong_by),
            "note": "Upper bound: assumes every caught ticket would have been resolved at L1.",
        }
