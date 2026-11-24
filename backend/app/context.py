from dataclasses import dataclass
from typing import Optional

from app.checks.escalation_gate import EscalationGate
from app.checks.known_issue_matcher import KnownIssueMatcher
from app.checks.reopen_guard import ReopenGuard
from app.repository.ticket_repository import TicketRepository
from app.services.backtester import Backtester
from app.services.data_service import DataCatalog
from app.services.feedback_store import FeedbackStore
from app.services.history_learner import HistoryLearner
from app.services.metrics_service import MetricsService
from app.services.triage_service import TriageService


@dataclass
class AppContext:
    """Everything the API needs. Rebuilt whenever the chosen datasets change. When no dataset is chosen, only the catalog exists."""
    catalog: DataCatalog
    signature: tuple
    feedback: FeedbackStore
    repo: Optional[TicketRepository] = None
    learner: Optional[HistoryLearner] = None
    triage: Optional[TriageService] = None
    metrics: Optional[MetricsService] = None
    backtester: Optional[Backtester] = None


def build_context(catalog: Optional[DataCatalog] = None) -> AppContext:
    """Combine the chosen datasets, learn from them, and wire the services together."""
    catalog = catalog or DataCatalog()
    signature = catalog.signature()                  # taken first: a change while we load triggers another reload
    feedback = FeedbackStore(catalog.state_dir / "feedback.json")
    frames = catalog.selected_frames()
    if not frames:
        return AppContext(catalog, signature, feedback)
    repo = TicketRepository().load_frames(frames, catalog.settings()["as_of"])
    learner = HistoryLearner()
    checks = [EscalationGate(), KnownIssueMatcher(), ReopenGuard()]
    learner.fit(repo)                 # learn from the full history
    learner.apply_to(checks)
    return AppContext(catalog, signature, feedback, repo, learner, TriageService(checks), MetricsService(repo), Backtester(repo))
