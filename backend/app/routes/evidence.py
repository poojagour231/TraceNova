from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path

from ..database import get_db
from ..models import Case, Evidence
from ..utils.hashing import calculate_sha256
from ..services.ingestion import BACKEND_DIR, ingest_csv


router = APIRouter(
    prefix="/cases",
    tags=["Evidence"]
)


@router.post("/{case_id}/evidence")
async def upload_evidence(
    case_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == case_id).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    file_bytes = await file.read()

    evidence_dir = BACKEND_DIR / "data" / "evidence"
    evidence_dir.mkdir(parents=True, exist_ok=True)

    file_path = evidence_dir / file.filename

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    ingested_data = None

    if file.filename.lower().endswith(".csv"):
        ingested_data = ingest_csv(str(file_path))

    file_hash = calculate_sha256(file_bytes)

    new_evidence = Evidence(
        filename=file.filename,
        file_type=file.content_type,
        file_hash=file_hash,
        file_path=str(file_path),
        case_id=case_id
    )

    db.add(new_evidence)
    db.commit()
    db.refresh(new_evidence)

    return {
        "message": "Evidence uploaded successfully",
        "evidence_id": new_evidence.id,
        "case_id": case_id,
        "filename": file.filename,
        "file_type": file.content_type,
        "sha256": file_hash,
        "records_ingested": len(ingested_data) if ingested_data else 0
    }