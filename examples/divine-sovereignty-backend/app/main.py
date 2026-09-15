from __future__ import annotations

from typing import Any

import stripe
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import close_client, insert_document
from .models import (
    CheckoutRequest,
    CheckoutResponse,
    DonateRequest,
    EnterpriseContactRequest,
    MessageResponse,
    SubscribeRequest,
)
from .notifications import send_transactional_email
from .rate_limit import SlidingWindowRateLimiter, client_key

settings = get_settings()
limiter = SlidingWindowRateLimiter(
    window_seconds=settings.rate_limit_window_seconds,
    max_requests=settings.rate_limit_max_requests,
)

app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup() -> None:
    if settings.stripe_secret_key:
        stripe.api_key = settings.stripe_secret_key


@app.on_event("shutdown")
async def shutdown() -> None:
    await close_client()


def require_stripe() -> None:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    stripe.api_key = settings.stripe_secret_key


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get("/api/config/offers")
async def list_offers() -> dict[str, Any]:
    return {
        "currency": settings.stripe_currency,
        "offers": [offer.model_dump() for offer in settings.offerings],
    }


@app.post("/api/payments/checkout", response_model=CheckoutResponse)
async def create_checkout(payload: CheckoutRequest, request: Request) -> CheckoutResponse:
    limiter.check(client_key(request, "checkout"))
    require_stripe()

    offering = settings.offerings_by_id.get(payload.offering_id)
    if offering is None:
        raise HTTPException(status_code=404, detail="Offering not found.")

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=payload.success_url or settings.frontend_success_url,
            cancel_url=payload.cancel_url or settings.frontend_cancel_url,
            customer_email=payload.email,
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": settings.stripe_currency,
                        "unit_amount": offering.price_cents,
                        "product_data": {
                            "name": offering.name,
                            "description": offering.description,
                        },
                    },
                }
            ],
            metadata={"type": "offering", "offering_id": offering.id},
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc.user_message or str(exc)}") from exc

    await insert_document(
        settings,
        "checkouts",
        {
            "type": "offering",
            "offering_id": offering.id,
            "email": payload.email,
            "session_id": session.id,
            "amount_cents": offering.price_cents,
            "currency": settings.stripe_currency,
            "status": "created",
        },
    )

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")

    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


@app.post("/api/payments/donate", response_model=CheckoutResponse)
async def create_donation(payload: DonateRequest, request: Request) -> CheckoutResponse:
    limiter.check(client_key(request, "donate"))
    require_stripe()

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            success_url=payload.success_url or settings.frontend_success_url,
            cancel_url=payload.cancel_url or settings.frontend_cancel_url,
            customer_email=payload.email,
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": settings.stripe_currency,
                        "unit_amount": payload.amount_cents,
                        "product_data": {
                            "name": "Divine Sovereignty Donation",
                            "description": payload.note or "One-time donation",
                        },
                    },
                }
            ],
            metadata={"type": "donation", "note": payload.note or ""},
        )
    except stripe.error.StripeError as exc:
        raise HTTPException(status_code=502, detail=f"Stripe error: {exc.user_message or str(exc)}") from exc

    await insert_document(
        settings,
        "donations",
        {
            "email": payload.email,
            "amount_cents": payload.amount_cents,
            "note": payload.note,
            "session_id": session.id,
            "currency": settings.stripe_currency,
            "status": "created",
        },
    )

    if not session.url:
        raise HTTPException(status_code=502, detail="Stripe did not return a checkout URL.")

    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


@app.post("/api/mail/subscribe", response_model=MessageResponse)
async def subscribe(payload: SubscribeRequest, request: Request) -> MessageResponse:
    limiter.check(client_key(request, "subscribe"))

    await insert_document(
        settings,
        "mailing_list",
        {
            "email": str(payload.email).lower(),
            "name": payload.name,
            "source": payload.source or "landing",
        },
    )

    await send_transactional_email(
        settings=settings,
        to_email=str(payload.email),
        subject="Welcome to Divine Sovereignty",
        html=(
            "<p>Thank you for joining the Divine Sovereignty list.</p>"
            "<p>You'll receive occasional notes on alignment, sovereignty, and equilibrium.</p>"
        ),
    )

    return MessageResponse(message="Subscribed. Welcome.")


@app.post("/api/contact/enterprise", response_model=MessageResponse)
async def enterprise_contact(payload: EnterpriseContactRequest, request: Request) -> MessageResponse:
    limiter.check(client_key(request, "enterprise"))

    await insert_document(
        settings,
        "enterprise_inquiries",
        {
            "name": payload.name,
            "email": str(payload.email).lower(),
            "organization": payload.organization,
            "message": payload.message,
            "budget_range": payload.budget_range,
        },
    )

    await send_transactional_email(
        settings=settings,
        to_email=settings.enterprise_contact_email,
        subject=f"Enterprise inquiry from {payload.name}",
        html=(
            f"<p><strong>Name:</strong> {payload.name}</p>"
            f"<p><strong>Email:</strong> {payload.email}</p>"
            f"<p><strong>Organization:</strong> {payload.organization or 'n/a'}</p>"
            f"<p><strong>Budget:</strong> {payload.budget_range or 'n/a'}</p>"
            f"<p><strong>Message:</strong></p><p>{payload.message}</p>"
        ),
    )

    await send_transactional_email(
        settings=settings,
        to_email=str(payload.email),
        subject="We received your enterprise inquiry",
        html=(
            "<p>Thank you for reaching out about Divine Sovereignty enterprise work.</p>"
            "<p>A steward will respond shortly.</p>"
        ),
    )

    return MessageResponse(message="Inquiry received. We'll be in touch.")


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request) -> dict[str, bool]:
    require_stripe()
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook secret is not configured.")

    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature.")

    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=signature,
            secret=settings.stripe_webhook_secret,
        )
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook payload.") from exc

    await insert_document(
        settings,
        "stripe_events",
        {
            "event_id": event.get("id"),
            "type": event.get("type"),
            "data": event.get("data", {}),
        },
    )

    return {"ok": True}
