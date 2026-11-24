from dataclasses import dataclass

from app import config
from app.checks.escalation_gate import EscalationGate
from app.checks.known_issue_matcher import KnownIssueMatcher
from app.checks.reopen_guard import ReopenGuard
from app.repository.ticket_repository import TicketRepository
from app.services.backtester import Backtester
from app.services.feedback_store import FeedbackStore
from app.services.history_learner import HistoryLearner
from app.services.metrics_service import MetricsService
from app.services.triage_service import TriageService


@dataclass
class AppContext:
    """Everything the API needs, built once at startup."""
    repo: TicketRepository
    learner: HistoryLearner
    triage: TriageService
    metrics: MetricsService
    backtester: Backtester
    feedback: FeedbackStore


def build_context(data_path=config.DATA_PATH, feedback_path=config.FEEDBACK_PATH) -> AppContext:
    repo = TicketRepository().load_csv(data_path)
    learner = HistoryLearner()
    checks = [EscalationGate(), KnownIssueMatcher(), ReopenGuard()]
    learner.fit(repo)                 # learn from the full history
    learner.apply_to(checks)
    return AppContext(repo, learner, TriageService(checks), MetricsService(repo), Backtester(repo),
                      FeedbackStore(feedback_path))
