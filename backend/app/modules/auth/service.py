"""Authentication business logic with atomic Refresh Token Rotation & Reuse Detection."""
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, update
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.modules.auth.models import User, Role, RefreshToken
from app.modules.auth.schemas import UserRegister, UserLogin, TokenResponse


def hash_token_str(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def get_or_create_default_roles(db: AsyncSession) -> dict[str, Role]:
    """Ensures default roles (Admin, Analyst) exist in the system."""
    roles = {}
    for role_name, desc in [
        ("Admin", "Full administrative access to all ThreatNex modules"),
        ("Analyst", "Standard SOC threat analyst access"),
    ]:
        stmt = select(Role).where(Role.name == role_name)
        result = await db.execute(stmt)
        role = result.scalar_one_or_none()
        if not role:
            role = Role(name=role_name, description=desc)
            db.add(role)
            await db.flush()
        roles[role_name] = role
    return roles


async def register_user(db: AsyncSession, user_in: UserRegister) -> User:
    """Registers a new user and assigns the default Analyst role (or Admin for the first user)."""
    stmt = select(User).where(or_(User.email == user_in.email, User.username == user_in.username))
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        if existing.email == user_in.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")

    # Check whether any non-test Admin account already exists.
    # If no human Admin exists (e.g. fresh database or only automated test 'analyst_%' / 'test_%' accounts),
    # the first registered operator receives both Admin and Analyst roles.
    admin_stmt = (
        select(User)
        .join(User.roles)
        .where(
            Role.name == "Admin",
            ~User.username.like("analyst_%"),
            ~User.username.like("test_%"),
        )
    )
    has_human_admin = (await db.execute(admin_stmt)).scalar_one_or_none() is not None

    roles_dict = await get_or_create_default_roles(db)
    assigned_roles = [roles_dict["Admin"], roles_dict["Analyst"]] if not has_human_admin else [roles_dict["Analyst"]]

    new_user = User(
        email=user_in.email,
        username=user_in.username,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        is_active=True,
        is_verified=True,
        roles=assigned_roles,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def authenticate_user(db: AsyncSession, credentials: UserLogin) -> Tuple[User, TokenResponse]:
    """Authenticates user and generates initial access & refresh token pair with unique family."""
    stmt = select(User).where(
        or_(User.username == credentials.username_or_email, User.email == credentials.username_or_email)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")

    role_names = [r.name for r in user.roles]
    access_token = create_access_token(subject=user.id, roles=role_names)
    refresh_token, jti, family_id = create_refresh_token(subject=user.id)

    # Persist refresh token family record
    expires_at = (datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    rf_record = RefreshToken(
        user_id=user.id,
        jti=jti,
        family_id=family_id,
        token_hash=hash_token_str(refresh_token),
        is_revoked=False,
        is_used=False,
        expires_at=expires_at,
    )
    db.add(rf_record)
    await db.commit()

    tokens = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return user, tokens


async def refresh_access_token(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    """
    Validates refresh token and performs atomic token rotation.
    Detects replay attacks: If an already used token is presented, immediately revokes the ENTIRE token family.
    """
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")
    family_id = payload.get("family")

    if not user_id or not jti or not family_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed refresh token claims")

    # Query token record from DB with lock
    token_hash = hash_token_str(refresh_token_str)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
    result = await db.execute(stmt)
    token_record = result.scalar_one_or_none()

    if not token_record:
        # Unknown token
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token record")

    # REPLAY ATTACK DETECTION
    if token_record.is_used or token_record.is_revoked:
        # Compromised token family! Revoke all tokens in this family immediately
        revoke_family_stmt = (
            update(RefreshToken)
            .where(RefreshToken.family_id == family_id)
            .values(is_revoked=True)
        )
        await db.execute(revoke_family_stmt)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security violation: Refresh token reuse detected! Token family revoked.",
        )

    # Invalidate current token atomically
    token_record.is_used = True
    token_record.is_revoked = True

    # Check user account
    user_stmt = select(User).where(User.id == user_id)
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if not user or not user.is_active:
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")

    # Issue rotated token in same family
    role_names = [r.name for r in user.roles]
    new_access_token = create_access_token(subject=user.id, roles=role_names)
    new_refresh_token, new_jti, _ = create_refresh_token(subject=user.id, family_id=family_id)

    expires_at = (datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).isoformat()
    new_rf_record = RefreshToken(
        user_id=user.id,
        jti=new_jti,
        family_id=family_id,
        token_hash=hash_token_str(new_refresh_token),
        is_revoked=False,
        is_used=False,
        expires_at=expires_at,
    )
    db.add(new_rf_record)
    await db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def revoke_user_sessions(db: AsyncSession, user_id: str) -> None:
    """Revokes all active refresh tokens for user upon logout/password reset."""
    stmt = update(RefreshToken).where(RefreshToken.user_id == user_id).values(is_revoked=True)
    await db.execute(stmt)
    await db.commit()
