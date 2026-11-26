"""Token Revocation Manager.
Uses SHA-256 token hashing or unique JTI, persisting to Redis with TTL.
Enforces strict fail-closed security in production if Redis is unavailable.
Falls back to bounded in-memory set exclusively during local development/testing.
"""
import hashlib
import logging
from typing import Optional, Set
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("threatnex.revocation")

# Fallback local memory set for offline development
_local_revoked_hashes: Set[str] = set()


def compute_token_hash(token: str) -> str:
    """Computes SHA-256 fingerprint of a token to avoid storing raw JWT strings."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def revoke_token(token: str, ttl_seconds: int = 86400) -> None:
    """Blacklists a token fingerprint until its natural expiration."""
    if not token:
        return
    token_hash = compute_token_hash(token)
    redis_client = await get_redis_client()
    if redis_client:
        try:
            await redis_client.set(f"revoked_token:{token_hash}", "1", ex=ttl_seconds)
            return
        except Exception as e:
            logger.error(f"Failed to record token revocation in Redis: {e}")
            if settings.ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Security service temporarily unavailable. Token revocation could not be persisted.",
                )
    else:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Security service temporarily unavailable. Distributed cache connection offline.",
            )

    # Local fallback for development / test mode
    logger.warning("Using local in-memory token revocation fallback (development mode only).")
    _local_revoked_hashes.add(token_hash)


async def is_token_revoked(token: str) -> bool:
    """Checks if token fingerprint has been revoked."""
    if not token:
        return True
    token_hash = compute_token_hash(token)
    redis_client = await get_redis_client()
    if redis_client:
        try:
            exists = await redis_client.exists(f"revoked_token:{token_hash}")
            return bool(exists)
        except Exception as e:
            logger.error(f"Failed to query token revocation from Redis: {e}")
            if settings.ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Security service temporarily unavailable. Revocation check failed.",
                )
    else:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Security service temporarily unavailable. Distributed cache connection offline.",
            )

    return token_hash in _local_revoked_hashes


def reset_local_revocation():
    """Testing helper to clear in-memory fallback."""
    _local_revoked_hashes.clear()
