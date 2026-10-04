from pydantic import BaseModel


class CaseCreate(BaseModel):
    case_number: str
    title: str
    description: str | None = None