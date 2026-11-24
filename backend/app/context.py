from dataclasses import dataclass
from pathlib import Path

from app import config
from app.checks.escalation_gate import EscalationGate
from app.checks.known_issue_matcher import KnownIssueMatcher
from app.checks.reopen_guard import ReopenGuard
from app.repository.ticket_repository import TicketRepository
from app.services.backtester import Backtester
from app.services.data_service import DataService, DataStore
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
    store: DataStore
    data: DataService


def build_context(state_dir: Path = config.STATE_DIR, data_path: Path = config.DATA_PATH) -> AppContext:
    """Load the original CSV plus any uploaded rows, learn from all of it, and wire the services together."""
    store = DataStore(state_dir)
    repo = TicketRepository().load_csv(data_path, extra=store.uploaded(), as_of=store.as_of())
    learner = HistoryLearner()
    checks = [EscalationGate(), KnownIssueMatcher(), ReopenGuard()]
    learner.fit(repo)                 # learn from the full history
    learner.apply_to(checks)
    return AppContext(repo, learner, TriageService(checks), MetricsService(repo), Backtester(repo),
                      FeedbackStore(Path(state_dir) / "feedback.json"), store, DataService(store, data_path))
