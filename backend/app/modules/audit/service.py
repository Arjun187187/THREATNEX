"""Audit service for logging critical security and operational actions."""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.audit.models import AuditLog


async def record_audit_log(
    db: AsyncSession,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    details: Optional[str] = None,
) -> AuditLog:
    """Asynchronously records an audit log entry in PostgreSQL/SQLite."""
    log_entry = AuditLog(
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        details=details,
    )
    db.add(log_entry)
    await db.flush()
    return log_entry
