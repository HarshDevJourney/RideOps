from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.api.deps import get_app
from app.context import AppContext
from app.services.data_service import UploadError

router = APIRouter(prefix="/api/data", tags=["data"])


class Selection(BaseModel):
    selected: Optional[List[str]] = None      # ids of the datasets to analyse; leave out to keep the current choice
    as_of: Optional[str] = None               # "data pulled on" date; null means automatic; leave out to keep it


@router.get("/status")
def status(ctx: AppContext = Depends(get_app)):
    """Every dataset found (the original and each file in the uploads folder), which are in use, and what they add up to."""
    return ctx.catalog.status(ctx.repo)


@router.post("/upload")
async def upload(request: Request, dry_run: bool = Query(True), name: str = Query("tickets.csv"), ctx: AppContext = Depends(get_app)):
    """Send a CSV as the request body. dry_run=true only checks it and reports; dry_run=false saves it as a new file in the
    uploads folder and starts using it. A ticket ID that is already loaded is replaced by the new file."""
    raw = await request.body()
    try:
        report = ctx.catalog.inspect(raw, ctx.repo)
    except UploadError as e:
        raise HTTPException(422, str(e))
    clean = report.pop("clean")
    report.update(applied=False, saved_as=None)
    if not dry_run:
        if not report["ok"]:
            raise HTTPException(422, "The file has errors. Fix them and check it again before adding it.")
        report["saved_as"] = ctx.catalog.save_upload(name, clean)
        get_app(request)                     # the folder changed, so this reloads right away
        report["applied"] = True
    return report


@router.put("/selection")
def select(body: Selection, request: Request, ctx: AppContext = Depends(get_app)):
    """Choose which datasets the whole app analyses, and optionally the "data pulled on" date."""
    try:
        ctx.catalog.apply_selection(body.selected, body.as_of, "as_of" in body.model_fields_set)
    except UploadError as e:
        raise HTTPException(422, str(e))
    ctx = get_app(request)
    return ctx.catalog.status(ctx.repo)


@router.delete("/datasets/{dataset_id}")
def delete(dataset_id: str, request: Request, ctx: AppContext = Depends(get_app)):
    """Delete an uploaded file from the uploads folder (same as deleting it by hand)."""
    try:
        ctx.catalog.delete_upload(dataset_id)
    except KeyError:
        raise HTTPException(404, "No such uploaded file.")
    except UploadError as e:
        raise HTTPException(422, str(e))
    ctx = get_app(request)
    return ctx.catalog.status(ctx.repo)
