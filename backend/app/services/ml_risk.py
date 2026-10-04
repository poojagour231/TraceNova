"""Feature extraction and prediction for CDR evidence."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

try:
    from ...ml.predict import predict_risk
except ImportError:
    from ml.predict import predict_risk


CDR_COLUMNS = {
    "calling_number",
    "called_number",
    "duration_sec",
    "call_type",
    "timestamp",
    "tower_id",
}


def predict_cdr_risk(records: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Predict risk for CDR rows while leaving non-CDR evidence untouched."""
    cdr_records = [
        (index, record)
        for index, record in enumerate(records)
        if _looks_like_cdr(record)
    ]
    if not cdr_records:
        return None

    parsed = []
    for index, record in cdr_records:
        parsed_record = _parse_cdr_record(record, index)
        if parsed_record is not None:
            parsed.append(parsed_record)

    if not parsed:
        return None
    caller_counts = Counter(item["calling_number"] for item in parsed)
    caller_called = defaultdict(set)
    caller_towers = defaultdict(set)
    pair_counts = Counter(
        (item["calling_number"], item["called_number"]) for item in parsed
    )
    caller_times = defaultdict(list)

    for item in parsed:
        caller = item["calling_number"]
        caller_called[caller].add(item["called_number"])
        caller_towers[caller].add(item["tower_id"])
        caller_times[caller].append(item["timestamp"])

    previous_gap = {}
    for caller, timestamps in caller_times.items():
        timestamps.sort()
        previous_gap[caller] = {
            timestamp: (
                int((timestamp - timestamps[position - 1]).total_seconds())
                if position
                else 0
            )
            for position, timestamp in enumerate(timestamps)
        }

    predictions = []
    for item in parsed:
        caller = item["calling_number"]
        pair = (caller, item["called_number"])
        features = {
            "duration_sec": item["duration_sec"],
            "call_type": item["call_type"],
            "hour": item["timestamp"].hour,
            "calls_per_number": caller_counts[caller],
            "unique_called_numbers": len(caller_called[caller]),
            "unique_towers": len(caller_towers[caller]),
            "repeated_call_count": max(0, pair_counts[pair] - 1),
            "time_gap_seconds": previous_gap[caller][item["timestamp"]],
        }
        result = predict_risk(features)
        predictions.append(
            {
                "record_index": item["record_index"],
                **result,
            }
        )

    probability = sum(item["fraud_probability"] for item in predictions) / len(predictions)
    return {
        "fraud_probability": round(probability, 4),
        "risk_level": _risk_level(probability),
        "predictions": predictions,
    }


def _looks_like_cdr(record: dict[str, Any]) -> bool:
    return CDR_COLUMNS.issubset(record)


def _parse_cdr_record(
    record: dict[str, Any],
    index: int
) -> dict[str, Any] | None:
    required = CDR_COLUMNS
    missing = sorted(
        column for column in required if record.get(column) in (None, "")
    )
    if missing:
        return None

    try:
        duration = int(record["duration_sec"])
        timestamp = datetime.fromisoformat(
            str(record["timestamp"]).replace("Z", "+00:00")
        )
    except (TypeError, ValueError):
        return None

    if duration < 0:
        return None

    return {
        "record_index": index,
        "calling_number": str(record["calling_number"]),
        "called_number": str(record["called_number"]),
        "duration_sec": duration,
        "call_type": str(record["call_type"]),
        "tower_id": str(record["tower_id"]),
        "timestamp": timestamp,
    }


def _risk_level(probability: float) -> str:
    if probability < 0.34:
        return "LOW"
    if probability < 0.67:
        return "MEDIUM"
    return "HIGH"
