from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class Offering(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    price_cents: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    offering_id: str = Field(min_length=1, max_length=64)
    email: Optional[EmailStr] = None
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class DonateRequest(BaseModel):
    amount_cents: int = Field(gt=0, le=1_000_000)
    email: Optional[EmailStr] = None
    note: Optional[str] = Field(default=None, max_length=500)
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None

    @field_validator("amount_cents")
    @classmethod
    def validate_amount(cls, value: int) -> int:
        if value < 100:
            raise ValueError("Minimum donation is 100 cents ($1).")
        return value


class SubscribeRequest(BaseModel):
    email: EmailStr
    name: Optional[str] = Field(default=None, max_length=120)
    source: Optional[str] = Field(default="landing", max_length=64)


class EnterpriseContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    organization: Optional[str] = Field(default=None, max_length=160)
    message: str = Field(min_length=10, max_length=4000)
    budget_range: Optional[str] = Field(default=None, max_length=80)


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class MessageResponse(BaseModel):
    ok: bool = True
    message: str
