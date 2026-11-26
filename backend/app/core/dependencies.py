"""FastAPI dependency injection for database, authentication, and RBAC.
Supports dual authentication: HttpOnly Secure Cookies and Authorization Bearer header.
Enforces distributed token revocation checks.
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_token
from app.core.token_revocation import is_token_revoked
from app.modules.auth.models import User

# Optional bearer for API clients
optional_security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Validates token from either:
    1. HttpOnly 'threatnex_access_token' cookie (preferred browser authentication)
    2. 'Authorization: Bearer <token>' header (API clients / tools)
    """
    token: Optional[str] = None
    is_cookie_auth = False

    # Check Bearer header first (API clients)
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif request.cookies.get("threatnex_access_token"):
        token = request.cookies.get("threatnex_access_token")
        is_cookie_auth = True

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # For browser cookie authentication on state-changing methods, enforce Anti-CSRF custom header
    if is_cookie_auth and request.method in ("POST", "PATCH", "PUT", "DELETE"):
        if request.headers.get("x-requested-with") != "XMLHttpRequest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF verification failed: Missing or invalid X-Requested-With header.",
            )

    # Check distributed token revocation blacklist (Redis-backed)
    if await is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )

    return user


def require_roles(allowed_roles: List[str]):
    """RBAC dependency to ensure user has at least one of the required roles."""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_names = [r.name for r in current_user.roles]
        if not any(role in user_role_names for role in allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
