"""Authentication REST API routes with HttpOnly Cookie issuance and CSRF security."""
from typing import Optional
from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.ratelimit import check_rate_limit
from app.core.token_revocation import revoke_token
from app.modules.auth.models import User
from app.modules.auth.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    TokenRefreshRequest,
    UserResponse,
)
from app.modules.auth.service import (
    register_user,
    authenticate_user,
    refresh_access_token,
    revoke_user_sessions,
)
from app.modules.audit.service import record_audit_log

router = APIRouter(prefix="/auth", tags=["Authentication"])


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Sets secure HttpOnly cookies for web browsers."""
    response.set_cookie(
        key="threatnex_access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.set_cookie(
        key="threatnex_refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
    )


def clear_auth_cookies(response: Response) -> None:
    """Clears authentication cookies upon logout."""
    response.delete_cookie(
        key="threatnex_access_token",
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    response.delete_cookie(
        key="threatnex_refresh_token",
        domain=settings.COOKIE_DOMAIN,
        path="/api/v1/auth",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user account with strict rate limiting."""
    await check_rate_limit(request, key_prefix="register", max_requests=10, window_seconds=60)
    user = await register_user(db, user_in)
    await record_audit_log(
        db=db,
        action="USER_REGISTERED",
        resource_type="USER",
        resource_id=user.id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=f"User {user.username} registered with email {user.email}",
    )
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        is_active=user.is_active,
        is_verified=user.is_verified,
        roles=[r.name for r in user.roles],
        created_at=user.created_at,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with username/email and password, issuing both HttpOnly cookies and JSON tokens."""
    await check_rate_limit(request, key_prefix="login", max_requests=10, window_seconds=60)

    user, tokens = await authenticate_user(db, credentials)

    # Issue HttpOnly secure cookies
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)

    await record_audit_log(
        db=db,
        action="USER_LOGIN_SUCCESS",
        resource_type="AUTH",
        resource_id=user.id,
        user_id=user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details="Successful login",
    )
    return tokens


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    payload: Optional[TokenRefreshRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using either HttpOnly cookie or request body."""
    await check_rate_limit(request, key_prefix="refresh", max_requests=30, window_seconds=60)

    refresh_token_str = None
    if payload and payload.refresh_token:
        refresh_token_str = payload.refresh_token
    else:
        # Browser cookie flow: Enforce anti-CSRF custom header
        if request.headers.get("x-requested-with") != "XMLHttpRequest":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF verification failed: Missing or invalid X-Requested-With header.",
            )
        refresh_token_str = request.cookies.get("threatnex_refresh_token")

    if not refresh_token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required",
        )

    tokens = await refresh_access_token(db, refresh_token_str)
    set_auth_cookies(response, tokens.access_token, tokens.refresh_token)
    return tokens


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve profile and RBAC roles for the currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        roles=[r.name for r in current_user.roles],
        created_at=current_user.created_at,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Terminates session, revokes access token fingerprint, revokes DB refresh family, and clears cookies."""
    # Revoke access token in Redis
    token = request.cookies.get("threatnex_access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if token:
        await revoke_token(token, ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    # Invalidate all user refresh tokens in database
    await revoke_user_sessions(db, current_user.id)

    # Clear browser cookies
    clear_auth_cookies(response)

    await record_audit_log(
        db=db,
        action="USER_LOGOUT",
        resource_type="AUTH",
        resource_id=current_user.id,
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details="User logged out and session revoked",
    )
    return {"message": "Successfully logged out and session revoked"}
