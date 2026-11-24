from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_ctx
from app.context import AppContext

router = APIRouter(prefix="/api", tags=["backtest"])


@router.get("/backtest")
def backtest(split: str = "", ctx: AppContext = Depends(get_ctx)):
    window = ctx.repo.backtest_window()
    split = split or window["default"]
    try:
        day = datetime.fromisoformat(split)
    except ValueError:
        raise HTTPException(422, "Use a date like 2026-09-01.")
    if not (datetime.fromisoformat(window["min"]) <= day <= datetime.fromisoformat(window["max"])):
        raise HTTPException(422, f"Pick a date between {window['min']} and {window['max']} so there is data on both sides.")
    return ctx.backtester.run(split)
