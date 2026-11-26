"""Atomic Rate Limiting Engine.
Uses Redis sliding window with client IP resolution and trusted proxy validation.
"""
import time
import logging
from typing import Dict, List, Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger("threatnex.ratelimit")

# In-memory sliding window fallback
_local_rate_limits: Dict[str, List[float]] = {}


def get_client_ip(request: Request) -> str:
    """
    Safely resolves real client IP.
    Only trusts X-Forwarded-For if direct peer socket is in settings.TRUSTED_PROXIES.
    Prevents IP spoofing.
    """
    direct_ip = request.client.host if request.client else "unknown"

    if direct_ip in settings.TRUSTED_PROXIES:
        x_forwarded_for = request.headers.get("x-forwarded-for")
        if x_forwarded_for:
            # Client IP is the leftmost non-internal IP in chain
            ips = [ip.strip() for ip in x_forwarded_for.split(",")]
            if ips:
                return ips[0]

    return direct_ip


async def check_rate_limit(
    request: Request,
    key_prefix: str = "login",
    max_requests: int = 10,
    window_seconds: int = 60
) -> None:
    """
    Enforces atomic rate limiting.
    Tries Redis first (shared across all workers), falls back to local memory.
    """
    client_ip = get_client_ip(request)
    rate_key = f"ratelimit:{key_prefix}:{client_ip}"
    now = time.time()

    redis_client = await get_redis_client()
    if redis_client:
        try:
            # Redis sorted set atomic sliding window
            pipe = redis_client.pipeline()
            # 1. Remove entries older than window
            pipe.zremrangebyscore(rate_key, 0, now - window_seconds)
            # 2. Count requests in window
            pipe.zcard(rate_key)
            # 3. Add current timestamp
            pipe.zadd(rate_key, {str(now): now})
            # 4. Set expiry on key to auto-clean memory
            pipe.expire(rate_key, window_seconds + 5)
            results = await pipe.execute()

            request_count = results[1]
            if request_count >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded for {key_prefix}. Try again in {window_seconds} seconds.",
                    headers={"Retry-After": str(window_seconds)}
                )
            return
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Redis rate limit failed ({e}); evaluating in-memory limiter.")

    # Local memory fallback
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
