from fastapi import APIRouter, Depends, Query

from app.api.deps import get_ctx
from app.context import AppContext

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/summary")
def summary(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.summary()


@router.get("/weekly")
def weekly(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.weekly_backlog()


@router.get("/yield")
def escalation_yield(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.escalation_yield()


@router.get("/bounce")
def bounce(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.bounce_rate()


@router.get("/agents")
def agents(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.agent_scorecard()


@router.get("/categories")
def categories(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.categories()


@router.get("/top-clients")
def top_clients(n: int = Query(3, ge=1, le=10), ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.top_clients(n)


@router.get("/success")
def success(ctx: AppContext = Depends(get_ctx)):
    """The weekly success measure: baseline vs latest, with targets."""
    return ctx.metrics.success()


@router.get("/category-trend")
def category_trend(ctx: AppContext = Depends(get_ctx)):
    return ctx.metrics.category_trend()
