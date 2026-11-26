"""In-memory rate limiter and token revocation blacklist."""
import time
from typing import Dict, Set, Tuple
from fastapi import Request, HTTPException, status

# In-memory blacklist for revoked token identifiers / signatures (JTI/token string)
_token_blacklist: Set[str] = set()

# In-memory rate limiting tracker: ip -> list of timestamps
_rate_limits: Dict[str, list[float]] = {}


def revoke_token(token: str) -> None:
    """Adds a token signature/jti to the revocation blacklist."""
    if token:
        _token_blacklist.add(token)


def is_token_revoked(token: str) -> bool:
    """Checks whether a token has been explicitly revoked upon logout."""
    return token in _token_blacklist


def check_rate_limit(request: Request, max_requests: int = 60, window_seconds: int = 60) -> None:
    """
    Enforces sliding-window rate limiting per client IP.
    Default: 60 requests per 60 seconds.
    """
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    
    if client_ip not in _rate_limits:
        _rate_limits[client_ip] = []

    # Filter out timestamps outside the active window
    valid_window_start = now - window_seconds
    _rate_limits[client_ip] = [ts for ts in _rate_limits[client_ip] if ts > valid_window_start]

    if len(_rate_limits[client_ip]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Too many requests, please try again later.",
            headers={"Retry-After": str(window_seconds)}
        )

    _rate_limits[client_ip].append(now)


def reset_rate_limits() -> None:
    """Utility for test suite to reset rate limits."""
    _rate_limits.clear()
    _token_blacklist.clear()
