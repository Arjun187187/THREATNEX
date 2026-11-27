"""Threat Reports REST API routes."""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.reports.schemas import (
    ReportGenerateRequest,
    ReportResponse,
    ReportListResponse,
)
from app.modules.reports.service import (
    generate_threat_report,
    list_threat_reports,
    get_threat_report_by_id,
    delete_threat_report,
)

router = APIRouter(prefix="/reports", tags=["Threat Intelligence Reporting"])


@router.get("/", response_model=ReportListResponse, status_code=status.HTTP_200_OK)
async def get_all_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve list of generated Threat Intelligence and Incident Case reports."""
    return await list_threat_reports(db=db, page=page, page_size=page_size)


@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a formal markdown and JSON threat intelligence briefing or case report."""
    return await generate_threat_report(db=db, req=payload, current_user=current_user)


@router.get("/{report_id}", response_model=ReportResponse, status_code=status.HTTP_200_OK)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve full markdown content and details for a report by ID."""
    return await get_threat_report_by_id(db=db, report_id=report_id)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Delete a threat report."""
    await delete_threat_report(db=db, report_id=report_id)
