from collections import defaultdict, deque
from time import monotonic

from fastapi import HTTPException, Request


class SlidingWindowRateLimiter:
    def __init__(self, max_requests: int = 10, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = monotonic()
        window_start = now - self.window_seconds
        bucket = self.requests[key]

        while bucket and bucket[0] < window_start:
            bucket.popleft()

        if len(bucket) >= self.max_requests:
            raise HTTPException(status_code=429, detail='Too many requests. Please try again soon.')

        bucket.append(now)


rate_limiter = SlidingWindowRateLimiter(max_requests=12, window_seconds=60)


def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else 'unknown'
    rate_limiter.check(f'{client_ip}:{request.url.path}')
