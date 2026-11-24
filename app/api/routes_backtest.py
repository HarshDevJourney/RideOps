from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app import config
from app.api.deps import get_ctx
from app.context import AppContext

router = APIRouter(prefix="/api", tags=["backtest"])


@router.get("/backtest")
def backtest(split: str = config.BACKTEST_SPLIT, ctx: AppContext = Depends(get_ctx)):
    try:
        day = datetime.fromisoformat(split)
    except ValueError:
        raise HTTPException(422, "Use a date like 2026-09-01.")
    if not (datetime.fromisoformat(config.BACKTEST_MIN) <= day <= datetime.fromisoformat(config.BACKTEST_MAX)):
        raise HTTPException(422, f"Pick a date between {config.BACKTEST_MIN} and {config.BACKTEST_MAX} so there is data on both sides.")
    return ctx.backtester.run(split)
