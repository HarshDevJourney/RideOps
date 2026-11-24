from abc import ABC, abstractmethod
from typing import List

from app.models.ticket import Ticket


class BaseCheck(ABC):
    """Parent of every check (Strategy pattern). TriageService only ever calls run(), learn(), evidence()."""
    name: str = "check"

    def learn(self, baselines: dict) -> None:
        """Receive what HistoryLearner found in past tickets. Default: nothing to learn."""

    @abstractmethod
    def run(self, ticket: Ticket) -> List[str]:
        """Return the tags this check puts on the ticket."""

    def evidence(self, ticket: Ticket) -> dict:
        """Extra facts behind the tags, shown to the agent. Default: none."""
        return {}
