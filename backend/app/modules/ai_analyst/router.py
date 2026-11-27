"""AI Threat Analyst REST API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.ai_analyst.schemas import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AIAnalysisListItem,
)
from app.modules.ai_analyst.service import (
    execute_ai_threat_analysis,
    list_ai_analyses,
    get_ai_analysis_by_id,
)

router = APIRouter(prefix="/ai-analyst", tags=["AI Cyber Threat Analyst"])


@router.post("/analyze", response_model=AIAnalysisResponse, status_code=status.HTTP_200_OK)
async def generate_ai_analysis(
    payload: AIAnalysisRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Synthesize multi-source threat intelligence telemetry for an observable using Google Gemini.
    Generates executive briefing, MITRE ATT&CK mapping, risk score, and containment actions.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await execute_ai_threat_analysis(
        db=db,
        req=payload,
        current_user=current_user,
        client_ip=client_ip,
        user_agent=user_agent,
    )


@router.get("/history", response_model=List[AIAnalysisListItem])
async def get_analysis_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve historical AI threat analyses and assessments."""
    return await list_ai_analyses(db=db, limit=limit, offset=offset)


@router.get("/{analysis_id}", response_model=AIAnalysisResponse)
async def get_analysis_detail(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve a single detailed AI threat assessment report by ID."""
    return await get_ai_analysis_by_id(db=db, analysis_id=analysis_id)
