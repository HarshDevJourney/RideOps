import os
import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api import routes_backtest, routes_data, routes_metrics, routes_queue
from app.api.deps import get_app
from app.context import build_context
from app.services.data_service import DataCatalog


def create_app(state_dir=config.STATE_DIR, uploads_dir=config.UPLOADS_DIR, data_path=config.DATA_PATH) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.reload_lock = threading.Lock()
        app.state.ctx = build_context(DataCatalog(data_path, uploads_dir, state_dir))   # load the chosen datasets and learn the rules
        yield

    app = FastAPI(title="RideOps Triage API", version="0.2.0", lifespan=lifespan)
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PUT", "DELETE"], allow_headers=["Content-Type"])
    app.include_router(routes_queue.router)
    app.include_router(routes_metrics.router)
    app.include_router(routes_backtest.router)
    app.include_router(routes_data.router)

    @app.get("/api/health", tags=["system"])
    def health(ctx=Depends(get_app)):
        return {"status": "ok", "tickets": len(ctx.repo.all()) if ctx.repo else 0}

    @app.get("/", include_in_schema=False)
    def root():
        return {"service": "RideOps Triage API", "docs": "/docs", "health": "/api/health"}

    return app


app = create_app()
