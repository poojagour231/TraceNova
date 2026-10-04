from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pathlib import Path

from ..database import get_db
from ..models import Case, Evidence
from ..services.ingestion import BACKEND_DIR, ingest_csv
from ..services.entity_resolution import resolve_entities
from ..services.graph_engine import build_graph
from ..services.ml_risk import predict_cdr_risk
from ..services.risk_engine import calculate_risk, get_risk_summary
from ..services.report_generator import generate_investigation_report


router = APIRouter(
    prefix="/analysis",
    tags=["Analysis"]
)


@router.post("/case/{case_id}")
def analyze_case(
    case_id: int,
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == case_id).first()

    if not case:
        raise HTTPException(
            status_code=404,
            detail="Case not found"
        )

    evidence = (
        db.query(Evidence)
        .filter(Evidence.case_id == case_id)
        .all()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="No evidence found for this case"
        )

    all_records = []

    for item in evidence:

        if item.filename.lower().endswith(".csv"):

            file_path = item.file_path

            if not file_path:
                file_path = str(
                    BACKEND_DIR / "data" / "evidence" / item.filename
                )

            try:
                records = ingest_csv(file_path)
            except FileNotFoundError as error:
                raise HTTPException(
                    status_code=404,
                    detail=str(error)
                ) from error

            all_records.extend(records)

    if not all_records:
        raise HTTPException(
            status_code=400,
            detail="No CSV records found"
        )

    relationships = resolve_entities(all_records)

    graph = build_graph(relationships, all_records)

    risk = calculate_risk(all_records)
    risk_summary = get_risk_summary(all_records)

    try:
        ml_risk = predict_cdr_risk(all_records)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        ) from error
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=503,
            detail="ML risk model is not available"
        ) from error

    analysis_result = {
        "case_id": case_id,
        "records_analyzed": len(all_records),
        "relationships": relationships,
        "graph": graph,
        "risk": risk,
        "risk_summary": risk_summary,
        "fraud_probability": ml_risk["fraud_probability"] if ml_risk else None,
        "risk_level": ml_risk["risk_level"] if ml_risk else None,
        "ml_predictions": ml_risk["predictions"] if ml_risk else []
    }
    report = generate_investigation_report(analysis_result)

    return {
        **analysis_result,
        "report": report
    }