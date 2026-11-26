"""ThreatNex FastAPI Main Application Entrypoint."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import engine, Base
from app.modules.auth.router import router as auth_router
from app.modules.indicators.router import router as indicators_router
from app.modules.investigations.router import router as investigations_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.audit.router import router as audit_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup if using SQLite/local dev
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Graceful shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Production-grade cybersecurity threat intelligence and investigation platform API. "
        "Built with FastAPI, SQLAlchemy 2, and Argon2id."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global secure exception handler to prevent leaking stack traces
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Log internal error safely
    import logging
    logging.getLogger("uvicorn.error").error(f"Unhandled server error: {exc}", exc_info=settings.DEBUG)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact the security operations team."},
    )


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Service health and liveness probe."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "1.0.0",
    }


# Include modular API routers
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(indicators_router, prefix=api_prefix)
app.include_router(investigations_router, prefix=api_prefix)
app.include_router(dashboard_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)
