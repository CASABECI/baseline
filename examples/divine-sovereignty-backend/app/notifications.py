from __future__ import annotations

import httpx

from .config import Settings


async def send_transactional_email(
    *, settings: Settings, to_email: str, subject: str, html: str
) -> None:
    if not settings.resend_api_key:
        return

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": "Bearer " + settings.resend_api_key},
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
        )
        response.raise_for_status()
