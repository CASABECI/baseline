from datetime import datetime, timezone
from typing import Annotated

import stripe
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from stripe.error import SignatureVerificationError

from .config import Settings, get_settings
from .database import mongo_manager
from .models import (
    CheckoutRequest,
    DonationRequest,
    EnterpriseContactRequest,
    MailingListRequest,
    Offering,
)
from .notifications import send_transactional_email
from .rate_limit import enforce_rate_limit


app = FastAPI(title='Divine Sovereignty API', version='1.0.0')
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['POST', 'GET'],
    allow_headers=['*'],
)


@app.on_event('startup')
async def startup() -> None:
    pass


@app.on_event('shutdown')
async def shutdown() -> None:
    await mongo_manager.close()


def get_offering_or_404(offerings: list[Offering], offering_id: str) -> Offering:
    for offering in offerings:
        if offering.id == offering_id:
            return offering
    raise HTTPException(status_code=404, detail='Offering not found.')


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/api/config/offers')
async def list_offerings(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, list[Offering]]:
    return {'offerings': settings.offerings}


@app.post('/api/payments/checkout', dependencies=[Depends(enforce_rate_limit)])
async def create_checkout_session(
    payload: CheckoutRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail='Payments are not configured.')

    offering = get_offering_or_404(settings.offerings, payload.offering_id)
    stripe.api_key = settings.stripe_secret_key

    session = stripe.checkout.Session.create(
        mode='payment',
        line_items=[
            {
                'price_data': {
                    'currency': settings.stripe_currency,
                    'product_data': {'name': offering.name, 'description': offering.description},
                    'unit_amount': offering.price_cents,
                },
                'quantity': 1,
            }
        ],
        success_url=f"{settings.frontend_url}/?payment=success",
        cancel_url=f"{settings.frontend_url}/?payment=cancelled",
        metadata={
            'kind': 'offering',
            'offering_id': offering.id,
            'offering_name': offering.name,
        },
    )
    return {'url': session.url}


@app.post('/api/payments/donate', dependencies=[Depends(enforce_rate_limit)])
async def create_donation_session(
    payload: DonationRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail='Donations are not configured.')

    stripe.api_key = settings.stripe_secret_key

    session = stripe.checkout.Session.create(
        mode='payment',
        line_items=[
            {
                'price_data': {
                    'currency': settings.stripe_currency,
                    'product_data': {'name': 'Divine Sovereignty Donation'},
                    'unit_amount': payload.amount_cents,
                },
                'quantity': 1,
            }
        ],
        success_url=f"{settings.frontend_url}/?donation=success",
        cancel_url=f"{settings.frontend_url}/?donation=cancelled",
        metadata={'kind': 'donation', 'amount_cents': str(payload.amount_cents)},
    )
    return {'url': session.url}


@app.post('/api/mail/subscribe', dependencies=[Depends(enforce_rate_limit)])
async def subscribe_mailing_list(
    payload: MailingListRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    db = mongo_manager.get_database(settings)

    existing = await db.mailing_list.find_one({'email': payload.email.lower()})
    if existing:
        return {'message': 'You are already subscribed.'}

    await db.mailing_list.insert_one(
        {
            'email': payload.email.lower(),
            'created_at': datetime.now(timezone.utc),
            'source': 'landing_page',
        }
    )

    await send_transactional_email(
        settings=settings,
        to_email=payload.email,
        subject='Welcome to Divine Sovereignty',
        html='<p>Thank you for joining the Divine Sovereignty mailing list.</p>',
    )
    return {'message': 'Subscription successful.'}


@app.post('/api/contact/enterprise', dependencies=[Depends(enforce_rate_limit)])
async def submit_enterprise_contact(
    payload: EnterpriseContactRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    db = mongo_manager.get_database(settings)

    await db.enterprise_inquiries.insert_one(
        {
            'name': payload.name,
            'email': payload.email.lower(),
            'organization': payload.organization,
            'message': payload.message,
            'created_at': datetime.now(timezone.utc),
        }
    )

    if settings.enterprise_contact_email:
        await send_transactional_email(
            settings=settings,
            to_email=settings.enterprise_contact_email,
            subject='New Enterprise/Investment Inquiry',
            html=(
                f'<p><strong>Name:</strong> {payload.name}</p>'
                f'<p><strong>Email:</strong> {payload.email}</p>'
                f'<p><strong>Organization:</strong> {payload.organization or "N/A"}</p>'
                f'<p><strong>Message:</strong><br>{payload.message}</p>'
            ),
        )

    return {'message': 'Inquiry submitted successfully.'}


@app.post('/api/webhooks/stripe')
async def stripe_webhook(request: Request, settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, bool]:
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail='Stripe webhook is not configured.')

    payload = await request.body()
    signature = request.headers.get('stripe-signature', '')

    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f'Invalid payload: {error}') from error
    except SignatureVerificationError as error:
        raise HTTPException(status_code=400, detail=f'Invalid signature: {error}') from error

    if event.get('type') == 'checkout.session.completed':
        session = event['data']['object']
        metadata = session.get('metadata', {})
        kind = metadata.get('kind', 'unknown')
        db = mongo_manager.get_database(settings)

        base_record = {
            'kind': kind,
            'stripe_session_id': session.get('id'),
            'amount_total': session.get('amount_total'),
            'currency': session.get('currency'),
            'customer_email': session.get('customer_details', {}).get('email'),
            'metadata': metadata,
            'created_at': datetime.now(timezone.utc),
        }

        if kind == 'donation':
            await db.donations.insert_one(base_record)
        else:
            await db.purchases.insert_one(base_record)

    return {'received': True}
