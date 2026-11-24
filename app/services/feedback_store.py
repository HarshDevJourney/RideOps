import json
import threading
from datetime import datetime
from pathlib import Path


class FeedbackStore:
    """Agent agree/disagree clicks on a verdict, saved to a small JSON file."""

    def __init__(self, path: Path):
        self.path, self._lock = Path(path), threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._rows = json.loads(self.path.read_text()) if self.path.exists() else []

    def add(self, ticket_id: str, agree: bool, note: str = "") -> dict:
        row = {"ticket_id": ticket_id, "agree": agree, "note": note, "at": datetime.now().isoformat(timespec="seconds")}
        with self._lock:
            self._rows = [r for r in self._rows if r["ticket_id"] != ticket_id] + [row]   # latest vote per ticket
            try:
                self.path.write_text(json.dumps(self._rows, indent=1))
            except OSError:
                pass
        return row

    def for_ticket(self, ticket_id: str):
        return next((r for r in self._rows if r["ticket_id"] == ticket_id), None)

    def summary(self) -> dict:
        total, agree = len(self._rows), sum(r["agree"] for r in self._rows)
        return {"total": total, "agree": agree, "disagree": total - agree,
                "agreement_rate": round(agree / total, 3) if total else None}
