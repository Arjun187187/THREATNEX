"""Authentication business logic."""
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.modules.auth.models import User, Role
from app.modules.auth.schemas import UserRegister, UserLogin, TokenResponse


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
    # Check if username or email already exists
    stmt = select(User).where(or_(User.email == user_in.email, User.username == user_in.username))
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        if existing.email == user_in.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already registered")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username is already taken")

    # Check total user count to make the very first user an Admin
    count_stmt = select(User)
    total_users = len((await db.execute(count_stmt)).scalars().all())

    roles_dict = await get_or_create_default_roles(db)
    assigned_roles = [roles_dict["Admin"], roles_dict["Analyst"]] if total_users == 0 else [roles_dict["Analyst"]]

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
    """Authenticates user and returns JWT access + refresh tokens."""
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
    refresh_token = create_refresh_token(subject=user.id)

    tokens = TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    return user, tokens


async def refresh_access_token(db: AsyncSession, refresh_token_str: str) -> TokenResponse:
    """Validates refresh token and generates fresh access & refresh tokens."""
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user session")

    role_names = [r.name for r in user.roles]
    new_access_token = create_access_token(subject=user.id, roles=role_names)
    new_refresh_token = create_refresh_token(subject=user.id)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
