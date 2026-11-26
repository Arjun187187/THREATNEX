"""Redis shared connection manager with connection pooling and timeouts."""
import logging
from typing import Optional
import redis.asyncio as aioredis
from app.core.config import settings

logger = logging.getLogger("threatnex.redis")

_redis_pool: Optional[aioredis.Redis] = None


async def get_redis_client() -> Optional[aioredis.Redis]:
    """Returns async Redis client from shared connection pool, or None if unavailable."""
    global _redis_pool
    if _redis_pool is None:
        try:
            _redis_pool = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=settings.REDIS_CONNECT_TIMEOUT,
                socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
            )
            # Test ping
            await _redis_pool.ping()
        except Exception as e:
            logger.warning(f"Redis connection unavailable ({e}); falling back gracefully where permitted.")
            _redis_pool = None
    return _redis_pool


async def close_redis():
    """Graceful shutdown of Redis connection pool."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
