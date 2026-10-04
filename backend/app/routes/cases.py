from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Case
from ..schemas import CaseCreate


router = APIRouter(
    prefix="/cases",
    tags=["Cases"]
)


@router.post("/")
def create_case(
    case_data: CaseCreate,
    db: Session = Depends(get_db)
):
    new_case = Case(
        case_number=case_data.case_number,
        title=case_data.title,
        description=case_data.description
    )

    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    return {
        "message": "Case created successfully",
        "case_id": new_case.id,
        "case_number": new_case.case_number
    }
@router.get("/")
def get_cases(
    db: Session = Depends(get_db)
):
    cases = db.query(Case).all()

    return cases
