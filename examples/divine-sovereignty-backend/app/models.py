from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class Offering(BaseModel):
    id: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=500)
    price_cents: int = Field(ge=100, le=200000)


class CheckoutRequest(BaseModel):
    offering_id: str = Field(min_length=2, max_length=80)


class DonationRequest(BaseModel):
    amount_cents: int = Field(ge=100, le=20000000)


class MailingListRequest(BaseModel):
    email: EmailStr


class EnterpriseContactRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    organization: Optional[str] = Field(default=None, max_length=140)
    message: str = Field(min_length=20, max_length=3000)
