from fastapi import HTTPException, Request

from app.context import AppContext, build_context


def get_app(request: Request) -> AppContext:
    """The current context. If a dataset file or the selection changed on disk, everything is reloaded first."""
    app = request.app
    ctx = app.state.ctx
    if ctx.catalog.signature() != ctx.signature:
        with app.state.reload_lock:
            ctx = app.state.ctx
            if ctx.catalog.signature() != ctx.signature:
                app.state.ctx = ctx = build_context(ctx.catalog)
    return ctx


def get_ctx(request: Request) -> AppContext:
    """Like get_app, but for pages that need tickets: says so clearly when no dataset is chosen."""
    ctx = get_app(request)
    if ctx.repo is None:
        raise HTTPException(503, "No ticket data is in use. Open Add data and tick a dataset.")
    return ctx
