from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SignupIn(BaseModel):
    agency_name: str = Field(min_length=2, max_length=200)
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AgencyOut(ORM):
    id: int
    name: str
    plan: str
    logo_url: str | None
    brand_color: str


class UserOut(ORM):
    id: int
    name: str
    email: str
    role: str
    email_alerts: bool
    agency: AgencyOut


class TokenOut(BaseModel):
    token: str
    user: UserOut


class AgencyUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    logo_url: str | None = None
    brand_color: str | None = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class CompetitorIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = None
    aliases: list[str] = []


class CompetitorOut(ORM, CompetitorIn):
    id: int


class ClientIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = None
    industry: str | None = None
    aliases: list[str] = []
    competitors: list[CompetitorIn] = []


class ClientUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    industry: str | None = None
    aliases: list[str] | None = None
    competitors: list[CompetitorIn] | None = None


class ClientOut(ORM):
    id: int
    name: str
    domain: str | None
    industry: str | None
    aliases: list[str]
    competitors: list[CompetitorOut]
    created_at: datetime


class ClientCard(ClientOut):
    prompt_count: int = 0
    visibility: float | None = None


class PromptIn(BaseModel):
    text: str = Field(min_length=3, max_length=1000)
    category: str | None = None


class PromptBulkIn(BaseModel):
    prompts: list[PromptIn] = Field(min_length=1, max_length=500)


class PromptUpdate(BaseModel):
    text: str | None = Field(None, min_length=3, max_length=1000)
    category: str | None = None
    active: bool | None = None


class PromptOut(ORM):
    id: int
    client_id: int
    text: str
    category: str | None
    active: bool
    runs: int = 0
    visibility: float | None = None
    avg_position: float | None = None
    last_run: datetime | None = None


class MentionOut(ORM):
    name: str
    is_client: bool
    position: int
    sentiment: float
    snippet: str | None


class CitationOut(ORM):
    url: str
    domain: str
    title: str | None


class RunOut(ORM):
    id: int
    prompt_id: int
    engine: str
    status: str
    is_mock: bool
    brand_mentioned: bool
    position: int | None
    sentiment: float | None
    latency_ms: int
    cost_usd: float
    error: str | None
    created_at: datetime


class RunDetail(RunOut):
    raw_response: str | None
    mentions: list[MentionOut]
    citations: list[CitationOut]


class SuggestIn(BaseModel):
    industry: str | None = None
    count: int = Field(15, ge=1, le=50)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class PrefsIn(BaseModel):
    email_alerts: bool | None = None
    name: str | None = Field(None, min_length=1, max_length=200)


class AlertOut(ORM):
    id: int
    client_id: int
    kind: str
    message: str
    read: bool
    created_at: datetime


class DraftIn(BaseModel):
    action_id: str = Field(min_length=1, max_length=300)
    facts: str = Field("", max_length=3000)
    days: int = Field(30, ge=1, le=365)
