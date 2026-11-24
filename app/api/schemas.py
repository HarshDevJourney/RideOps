from typing import List, Literal

from pydantic import BaseModel, Field, field_validator

from app.models.ticket import Ticket


class TriageRequest(BaseModel):
    category: str
    description: str = Field(min_length=3, max_length=500)
    priority: Literal["P1", "P2", "P3", "P4"] = "P3"
    info_provided: List[str] = []

    @field_validator("description")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Describe the issue in at least 3 characters.")
        return v


class FeedbackRequest(BaseModel):
    ticket_id: str
    agree: bool
    note: str = ""


def ticket_to_dict(t: Ticket) -> dict:
    return {"ticket_id": t.ticket_id, "client_id": t.client_id, "client": t.client_name, "category": t.category,
            "priority": t.priority, "description": t.description, "agent": t.assigned_agent, "status": t.status,
            "escalated": t.escalated, "handoffs": t.eng_handoffs, "reopens": t.reopen_count,
            "eng_outcome": t.eng_outcome, "age_days": t.age_days(), "created_at": t.created_at.isoformat(timespec="minutes"),
            "channel": t.channel}
