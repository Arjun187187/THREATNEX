"""Token Revocation Manager.
Uses SHA-256 token hashing or unique JTI, persisting to Redis with TTL.
Falls back to bounded in-memory set if Redis is offline during local dev.
"""
import hashlib
import logging
from typing import Optional, Set
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
    # Local fallback
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
    return token_hash in _local_revoked_hashes


def reset_local_revocation():
    """Testing helper to clear in-memory fallback."""
    _local_revoked_hashes.clear()
