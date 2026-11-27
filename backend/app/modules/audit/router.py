"""Audit logs router with compliance filtering and RBAC controls."""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.audit.models import AuditLog
from app.modules.auth.models import User

router = APIRouter(prefix="/audit", tags=["Compliance Audit Logs"])


class AuditLogItemResponse(BaseModel):
    id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    user_id: Optional[str] = None
    username: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: List[AuditLogItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/logs", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
async def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter by action type (e.g. LOGIN, CREATE_ALERT)"),
    resource_type: Optional[str] = Query(None, description="Filter by resource (e.g. auth, alert, ioc)"),
    search: Optional[str] = Query(None, description="Search in details, action, or IP"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Retrieve immutable system compliance audit logs.
    Captures user authentication events, IOC investigations, alert actions, and administrative updates.
    """
    filters = []
    if action and action.strip() and action.lower() != "all":
        filters.append(AuditLog.action == action.strip().upper())
    if resource_type and resource_type.strip() and resource_type.lower() != "all":
        filters.append(AuditLog.resource_type == resource_type.strip().lower())
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                AuditLog.action.ilike(term),
                AuditLog.resource_type.ilike(term),
                AuditLog.details.ilike(term),
                AuditLog.ip_address.ilike(term),
            )
        )

    count_stmt = select(func.count()).select_from(AuditLog)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = (
        select(AuditLog, User.username)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(desc(AuditLog.created_at))
        .offset(offset)
        .limit(page_size)
    )
    if filters:
        stmt = stmt.where(*filters)

    rows = (await db.execute(stmt)).all()

    items = []
    for log, uname in rows:
        items.append(
            AuditLogItemResponse(
                id=log.id,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                user_id=log.user_id,
                username=uname or "System / Anonymous",
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                details=log.details,
                created_at=log.created_at,
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return AuditLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
