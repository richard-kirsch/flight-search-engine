import time
from typing import List, Dict


class FlightCache:
    def __init__(self, ttl_seconds: int = 86400):  # Default 24h
        self._cache = {}
        self.ttl = ttl_seconds

    def _get_key(self, origin: str, dest: str, dt: str) -> str:
        return f"{origin}:{dest}:{dt}"

    def get(self, origin: str, dest: str, dt: str):
        key = self._get_key(origin, dest, dt)
        entry = self._cache.get(key)
        if not entry:
            return None

        # Check if expired
        if time.time() > entry["expiry"]:
            del self._cache[key]
            return None

        return entry["data"]

    def set(self, origin: str, dest: str, dt: str, data: List[Dict]):
        key = self._get_key(origin, dest, dt)
        self._cache[key] = {
            "expiry": time.time() + self.ttl,
            "data": data
        }

    def cleanup(self):
        """Remove all expired entries to free memory."""
        now = time.time()
        expired_keys = [k for k, v in self._cache.items() if now > v["expiry"]]
        for k in expired_keys:
            del self._cache[k]

