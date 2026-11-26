"""Investigation REST API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.investigations.models import InvestigationStatus
from app.modules.investigations.schemas import (
    InvestigationCreate,
    InvestigationUpdate,
    InvestigationResponse,
)
from app.modules.investigations.service import (
    create_investigation,
    list_investigations,
    get_investigation_by_id,
    update_investigation,
)
from app.modules.audit.service import record_audit_log

router = APIRouter(prefix="/investigations", tags=["Investigations"])


@router.post("/", response_model=InvestigationResponse, status_code=status.HTTP_201_CREATED)
async def create_new_investigation(
    payload: InvestigationCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new security investigation case."""
    inv = await create_investigation(db, payload, owner_id=current_user.id)
    await record_audit_log(
        db=db,
        action="INVESTIGATION_CREATED",
        resource_type="INVESTIGATION",
        resource_id=inv.id,
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Created investigation '{inv.title}' with priority {inv.priority.value}",
    )
    return inv


@router.get("/", response_model=List[InvestigationResponse])
async def get_all_investigations(
    status_filter: Optional[InvestigationStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve all investigations with optional status filter."""
    return await list_investigations(db, status_filter=status_filter, limit=limit, offset=offset)


@router.get("/{investigation_id}", response_model=InvestigationResponse)
async def get_single_investigation(
    investigation_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details of a single investigation case with object-level authorization."""
    inv = await get_investigation_by_id(db, investigation_id)
    user_roles = [r.name for r in current_user.roles]
    # Enforce object authorization: Admins can view any case; Analysts can view unassigned or assigned cases or cases they own
    if "Admin" not in user_roles and inv.owner_id and inv.owner_id != current_user.id:
        if inv.assigned_to and inv.assigned_to != current_user.username:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to access this private investigation case."
            )
    return inv


@router.patch("/{investigation_id}", response_model=InvestigationResponse)
async def patch_investigation(
    investigation_id: str,
    payload: InvestigationUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update title, status, priority, or attached IOCs with IDOR authorization."""
    inv = await get_investigation_by_id(db, investigation_id)
    user_roles = [r.name for r in current_user.roles]
    if "Admin" not in user_roles and inv.owner_id and inv.owner_id != current_user.id:
        if inv.assigned_to and inv.assigned_to != current_user.username:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Unauthorized attempt to modify an investigation case."
            )

    inv = await update_investigation(db, investigation_id, payload)
    await record_audit_log(
        db=db,
        action="INVESTIGATION_UPDATED",
        resource_type="INVESTIGATION",
        resource_id=inv.id,
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"Updated investigation {inv.id} status to {inv.status.value}",
    )
    return inv
