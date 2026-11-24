from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app import config
from app.api.deps import get_ctx
from app.context import AppContext, build_context
from app.services.data_service import UploadError

router = APIRouter(prefix="/api/data", tags=["data"])


@router.get("/status")
def status(ctx: AppContext = Depends(get_ctx)):
    """What data is loaded now: how many tickets, which dates, how many came from uploads."""
    return ctx.data.status(ctx.repo)


@router.post("/upload")
async def upload(request: Request, dry_run: bool = Query(True), as_of: Optional[str] = Query(None),
                 ctx: AppContext = Depends(get_ctx)):
    """Send a CSV as the request body. dry_run=true only checks it and reports; dry_run=false saves it and reloads the app.
    Tickets with a new ID are added. Tickets whose ID already exists are replaced (that is how open tickets get their close date)."""
    raw = await request.body()
    try:
        report = ctx.data.inspect(raw, ctx.repo, as_of or None)
    except UploadError as e:
        raise HTTPException(422, str(e))
    merged = report.pop("clean")
    report["applied"] = False
    if not dry_run:
        if not report["ok"]:
            raise HTTPException(422, "The file has errors. Fix them and check it again before applying.")
        ctx.store.save(merged, as_of or None)
        request.app.state.ctx = build_context(state_dir=request.app.state.state_dir)   # reload everything on the new data
        report["applied"] = True
    return report


@router.delete("/upload")
def reset(request: Request, ctx: AppContext = Depends(get_ctx)):
    """Forget every uploaded file and go back to the original CSV."""
    ctx.store.reset()
    request.app.state.ctx = build_context(state_dir=request.app.state.state_dir)
    return request.app.state.ctx.data.status(request.app.state.ctx.repo)
