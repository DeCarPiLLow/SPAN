import json
import functools
from app.extensions import redis_client


def get_json(key: str):
    val = redis_client.get(key)
    return json.loads(val) if val else None


def set_json(key: str, value, ttl: int):
    redis_client.setex(key, ttl, json.dumps(value, default=str))


def invalidate(key: str):
    redis_client.delete(key)


def invalidate_pattern(pattern: str):
    keys = redis_client.keys(pattern)
    if keys:
        redis_client.delete(*keys)


def invalidate_user_analytics_cache(user_id: str) -> None:
    """Remove cached API responses for one user. Sync must call this or stale empty
    payloads keep being served (Top Tracks bypasses DB and still looks “fine”)."""
    uid = str(user_id)
    keys = [
        f"analytics:listening_clock:{uid}",
        f"analytics:mood_radar:{uid}",
        f"analytics:discovery:{uid}",
        f"analytics:persona:{uid}",
        f"analytics:mainstream:{uid}",
        f"analytics:taste_twin:{uid}",
        f"receipt:data:{uid}",
    ]
    for tr in ("short_term", "medium_term", "long_term"):
        keys.append(f"analytics:top_tracks:{uid}:{tr}")
        keys.append(f"analytics:top_artists:{uid}:{tr}")
    for k in keys:
        invalidate(k)


def cached(key_fn, ttl: int):
    """Decorator factory. key_fn receives the same args as the wrapped fn."""
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            key    = key_fn(*args, **kwargs)
            cached = get_json(key)
            if cached is not None:
                return cached
            result = fn(*args, **kwargs)
            set_json(key, result, ttl)
            return result
        return wrapper
    return decorator
