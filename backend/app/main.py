import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.api import routes_backtest, routes_metrics, routes_queue
from app.context import build_context


def create_app(feedback_path=config.FEEDBACK_PATH) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ctx = build_context(feedback_path=feedback_path)   # load the CSV and learn the rules once
        yield

    app = FastAPI(title="RideOps Triage API", version="0.2.0", lifespan=lifespan)
    origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    app.include_router(routes_queue.router)
    app.include_router(routes_metrics.router)
    app.include_router(routes_backtest.router)

    @app.get("/api/health", tags=["system"])
    def health():
        return {"status": "ok", "tickets": len(app.state.ctx.repo.all())}

    @app.get("/", include_in_schema=False)
    def root():
        return {"service": "RideOps Triage API", "docs": "/docs", "health": "/api/health"}

    return app


app = create_app()
