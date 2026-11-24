import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api import routes_backtest, routes_data, routes_metrics, routes_queue
from app.context import build_context


def create_app(state_dir=config.STATE_DIR) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ctx = build_context(state_dir=state_dir)   # load the CSV (and any uploads) and learn the rules once
        app.state.state_dir = state_dir
        yield

    app = FastAPI(title="RideOps Triage API", version="0.2.0", lifespan=lifespan)
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "DELETE"], allow_headers=["Content-Type"])
    app.include_router(routes_queue.router)
    app.include_router(routes_metrics.router)
    app.include_router(routes_backtest.router)
    app.include_router(routes_data.router)

    @app.get("/api/health", tags=["system"])
    def health():
        return {"status": "ok", "tickets": len(app.state.ctx.repo.all())}

    @app.get("/", include_in_schema=False)
    def root():
        return {"service": "RideOps Triage API", "docs": "/docs", "health": "/api/health"}

    return app


app = create_app()
