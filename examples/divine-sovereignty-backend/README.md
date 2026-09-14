# Divine Sovereignty Backend (FastAPI)

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
