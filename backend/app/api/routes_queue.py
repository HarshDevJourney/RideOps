from collections import Counter
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app import config
from app.api.deps import get_ctx
from app.api.schemas import FeedbackRequest, TriageRequest, ticket_to_dict
from app.context import AppContext
from app.models.ticket import Ticket
from app.tags import L1_ACTION_TAGS, TAG_META

router = APIRouter(prefix="/api", tags=["queue"])


@router.get("/meta")
def meta(ctx: AppContext = Depends(get_ctx)):
    bt = ctx.repo.backtest_window()
    return {"as_of": ctx.repo.as_of.isoformat(timespec="minutes"), "first_date": ctx.repo.first_day.date().isoformat(), "tags": TAG_META,
            "categories": sorted(config.REQUIRED_INFO), "required_info": config.REQUIRED_INFO,
            "default_split": bt["default"], "split_min": bt["min"], "split_max": bt["max"], "tickets": len(ctx.repo.all()),
            "open": len(ctx.repo.open_queue()), "datasets": [d.name for d in ctx.catalog.datasets() if d.selected]}


@router.get("/queue")
def queue(ctx: AppContext = Depends(get_ctx)):
    """The tickets still open on the data's "as of" date, each with tags and a recommended action."""
    rows = ctx.triage.tag_queue(ctx.repo.open_queue())
    items = [{**ticket_to_dict(t), "verdict": v.to_dict(), "feedback": ctx.feedback.for_ticket(t.ticket_id)} for t, v in rows]
    counts = Counter(tag for _, v in rows for tag in v.tags)
    l1_action = sum(bool(L1_ACTION_TAGS & set(v.tags)) for _, v in rows)
    ages = Counter(min(t.age_days(), 9) for t, _ in rows)
    return {"items": items, "tag_counts": dict(counts),
            "totals": {"open": len(rows), "with_l1": sum(t.status == "Open - with L1" for t, _ in rows),
                       "with_engineering": sum(t.status == "Open - with Engineering" for t, _ in rows),
                       "hold": sum(v.hold_escalation for _, v in rows), "p1": counts.get("P1", 0),
                       "l1_action": l1_action},
            "age_histogram": [ages.get(i, 0) for i in range(10)]}


@router.get("/tickets/{ticket_id}")
def ticket(ticket_id: str, ctx: AppContext = Depends(get_ctx)):
    try:
        t = ctx.repo.get(ticket_id)
    except KeyError:
        raise HTTPException(404, f"Ticket {ticket_id} not found. Check the ID and try again.")
    return {**ticket_to_dict(t), "verdict": ctx.triage.assess(t).to_dict(), "feedback": ctx.feedback.for_ticket(ticket_id)}


@router.post("/triage")
def triage_manual(req: TriageRequest, ctx: AppContext = Depends(get_ctx)):
    """Manual form: type a new ticket and see what the tool would advise before escalating."""
    if req.category not in config.REQUIRED_INFO:
        raise HTTPException(422, "Pick one of the known categories.")
    t = Ticket(ticket_id="NEW-TICKET", created_at=ctx.repo.as_of, as_of=ctx.repo.as_of, client_id="", client_name="Manual entry",
               category=req.category, priority=req.priority, description=req.description, info_provided=req.info_provided)
    return {**ticket_to_dict(t), "verdict": ctx.triage.assess(t).to_dict()}


@router.post("/feedback")
def feedback(req: FeedbackRequest, ctx: AppContext = Depends(get_ctx)):
    try:
        ctx.repo.get(req.ticket_id)
    except KeyError:
        raise HTTPException(404, f"Ticket {req.ticket_id} not found.")
    return ctx.feedback.add(req.ticket_id, req.agree, req.note)


@router.get("/feedback/summary")
def feedback_summary(ctx: AppContext = Depends(get_ctx)):
    return ctx.feedback.summary()
