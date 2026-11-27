"""Security Alerts REST API routes."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.alerts.schemas import (
    AlertCreate,
    AlertResponse,
    AlertListResponse,
    AlertStatsResponse,
    AlertResolveRequest,
    AlertEscalateRequest,
)
from app.modules.alerts.service import (
    list_alerts,
    get_alert_by_id,
    create_alert,
    acknowledge_alert,
    resolve_alert,
    escalate_alert,
    get_alert_statistics,
)

router = APIRouter(prefix="/alerts", tags=["Security Alerts"])


@router.get("/", response_model=AlertListResponse, status_code=status.HTTP_200_OK)
async def get_all_alerts(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by alert status (open, acknowledged, resolved, escalated)"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    search: Optional[str] = Query(None, description="Search by title, indicator, or rule"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve paginated security alerts with filtering."""
    return await list_alerts(
        db=db,
        status_filter=status_filter,
        severity_filter=severity,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=AlertStatsResponse, status_code=status.HTTP_200_OK)
async def get_alerts_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve aggregation counts for alerts grouped by status and severity."""
    return await get_alert_statistics(db=db)


@router.post("/", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def create_new_alert(
    payload: AlertCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate or ingest a new security alert."""
    return await create_alert(db=db, data=payload, created_by_user=current_user)


@router.get("/{alert_id}", response_model=AlertResponse, status_code=status.HTTP_200_OK)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve full details of an alert by ID."""
    return await get_alert_by_id(db=db, alert_id=alert_id)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse, status_code=status.HTTP_200_OK)
async def ack_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert and claim ownership."""
    return await acknowledge_alert(db=db, alert_id=alert_id, user=current_user)


@router.post("/{alert_id}/resolve", response_model=AlertResponse, status_code=status.HTTP_200_OK)
async def res_alert(
    alert_id: str,
    payload: AlertResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve an alert with closing analyst notes."""
    return await resolve_alert(db=db, alert_id=alert_id, data=payload, user=current_user)


@router.post("/{alert_id}/escalate", response_model=AlertResponse, status_code=status.HTTP_200_OK)
async def esc_alert(
    alert_id: str,
    payload: AlertEscalateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Escalate an alert into an incident investigation case."""
    return await escalate_alert(db=db, alert_id=alert_id, data=payload, user=current_user)
