"""Load the saved CDR model and score a new feature record."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

try:
    from .create_training_data import FEATURE_COLUMNS
except ImportError:
    from create_training_data import FEATURE_COLUMNS


MODEL_PATH = Path(__file__).resolve().parent / "model" / "cdr_risk_model.joblib"


@lru_cache(maxsize=1)
def _load_model():
    return joblib.load(MODEL_PATH)


def predict_risk(features: dict[str, Any]) -> dict[str, Any]:
    """Return fraud probability and a LOW, MEDIUM, or HIGH risk level."""
    missing = [column for column in FEATURE_COLUMNS if column not in features]
    if missing:
        raise ValueError(f"Missing prediction features: {', '.join(missing)}")

    model = _load_model()
    model_input = pd.DataFrame(
    [{column: features[column] for column in FEATURE_COLUMNS}]
    )
    probability = float(model.predict_proba(model_input)[0][1])
    if probability < 0.34:
        risk_level = "LOW"
    elif probability < 0.67:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"
    return {"fraud_probability": round(probability, 4), "risk_level": risk_level}
