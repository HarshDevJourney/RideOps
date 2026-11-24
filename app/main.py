from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import config
from app.api import routes_backtest, routes_metrics, routes_queue
from app.context import build_context


def create_app(feedback_path=config.FEEDBACK_PATH) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.ctx = build_context(feedback_path=feedback_path)   # load the CSV and learn the rules once
        yield

    app = FastAPI(title="RideOps Triage", version="0.1.0", lifespan=lifespan)
    app.include_router(routes_queue.router)
    app.include_router(routes_metrics.router)
    app.include_router(routes_backtest.router)
    app.mount("/", StaticFiles(directory=config.FRONTEND_DIR, html=True), name="frontend")
    return app


app = create_app()
