"""Atomic Rate Limiting Engine.
Uses Redis sliding window with client IP resolution and trusted proxy validation.
Enforces fail-closed protection in production and bounded local memory for development.
"""
import uuid
import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("threatnex.ratelimit")

# In-memory sliding window fallback for local development/testing
_local_rate_limits: Dict[str, List[float]] = {}


def get_client_ip(request: Request) -> str:
    """
    Safely resolves real client IP.
    Only trusts X-Forwarded-For if direct peer socket is in settings.TRUSTED_PROXIES.
    Prevents IP spoofing by traversing proxy chain right-to-left.
    """
    direct_ip = request.client.host if request.client else "unknown"

    if direct_ip in settings.TRUSTED_PROXIES:
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            raw_ips = [ip.strip() for ip in x_forwarded_for.split(",") if ip.strip()]
            # Proxies append IPs right-to-left. Traverse backwards and take the first untrusted IP.
            for ip in reversed(raw_ips):
                if ip not in settings.TRUSTED_PROXIES:
                    return ip
            if raw_ips:
                return raw_ips[0]

    return direct_ip


async def check_rate_limit(
    request: Request,
    key_prefix: str = "login",
    max_requests: int = 10,
    window_seconds: int = 60
) -> None:
    """
    Enforces atomic rate limiting.
    Tries Redis first (shared across all workers), falls back to local memory in dev.
    """
    client_ip = get_client_ip(request)
    rate_key = f"ratelimit:{key_prefix}:{client_ip}"
    now = time.time()

    redis_client = await get_redis_client()
    if redis_client:
        try:
            # Atomic sliding window in Redis with unique members to avoid timestamp collisions
            member = f"{now}:{uuid.uuid4()}"
            pipe = redis_client.pipeline()
            # 1. Remove entries older than window
            pipe.zremrangebyscore(rate_key, 0, now - window_seconds)
            # 2. Add current request with unique member
            pipe.zadd(rate_key, {member: now})
            # 3. Count requests currently in window
            pipe.zcard(rate_key)
            # 4. Set expiry on key to auto-clean memory
            pipe.expire(rate_key, window_seconds + 5)
            results = await pipe.execute()

            request_count = results[2]
            if request_count > max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {key_prefix}. Try again in {window_seconds} seconds.",
                    headers={"Retry-After": str(window_seconds)}
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Redis rate limit failed: {e}")
            if settings.ENVIRONMENT == "production":
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Rate limiting security service unavailable.",
                )
    else:
        if settings.ENVIRONMENT == "production":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Rate limiting security service unavailable. Distributed cache offline.",
            )

    # Local memory fallback (development / test mode)
    logger.warning("Using local in-memory rate limiting fallback (development mode only).")
    if rate_key not in _local_rate_limits:
        _local_rate_limits[rate_key] = []

    valid_start = now - window_seconds
    _local_rate_limits[rate_key] = [ts for ts in _local_rate_limits[rate_key] if ts > valid_start]

    if len(_local_rate_limits[rate_key]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Too many requests, please try again in {window_seconds} seconds.",
            headers={"Retry-After": str(window_seconds)}
        )

    _local_rate_limits[rate_key].append(now)


def reset_local_rate_limits():
    """Testing helper to clear fallback memory."""
    _local_rate_limits.clear()
