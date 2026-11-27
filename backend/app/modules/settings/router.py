"""SOC Policies and Settings REST API routes."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.settings.schemas import (
    SOCSettingsResponse,
    ScoringWeightsUpdate,
    AlertThresholdsUpdate,
)
from app.modules.settings.service import (
    get_soc_settings,
    update_scoring_weights,
    update_alert_thresholds,
)

router = APIRouter(prefix="/settings", tags=["SOC Policies & Settings"])


@router.get("/", response_model=SOCSettingsResponse, status_code=status.HTTP_200_OK)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve current SOC scoring weights, alert thresholds, and provider configuration status."""
    return await get_soc_settings(db=db)


@router.put("/scoring-weights", response_model=SOCSettingsResponse, status_code=status.HTTP_200_OK)
async def set_scoring_weights(
    payload: ScoringWeightsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update multi-engine threat calculation weights."""
    return await update_scoring_weights(db=db, payload=payload, user=current_user)


@router.put("/alert-thresholds", response_model=SOCSettingsResponse, status_code=status.HTTP_200_OK)
async def set_alert_thresholds(
    payload: AlertThresholdsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update automated alert creation thresholds and auto-escalation rules."""
    return await update_alert_thresholds(db=db, payload=payload, user=current_user)
