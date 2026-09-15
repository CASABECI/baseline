# Divine Sovereignty Backend (FastAPI)

Handles Stripe checkout/donations, mailing list capture, enterprise inquiries, MongoDB persistence, and optional Resend email notifications.

## Setup

1. Create a Python 3.11+ virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env` and fill required values.
4. Run locally:

```bash
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `GET /api/config/offers`
- `POST /api/payments/checkout`
- `POST /api/payments/donate`
- `POST /api/mail/subscribe`
- `POST /api/contact/enterprise`
- `POST /api/webhooks/stripe`

## Notes

- Offerings are configured with `OFFERING_CATALOG_JSON`.
- Stripe and Resend keys are optional for local UI development; payment routes return `503` until Stripe is configured.
- Rate limiting is a simple in-memory sliding window per client IP and route scope.
