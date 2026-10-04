"""Create a deterministic synthetic dataset for the first CDR risk model."""

from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path


FEATURE_COLUMNS = [
    "duration_sec",
    "call_type",
    "hour",
    "calls_per_number",
    "unique_called_numbers",
    "unique_towers",
    "repeated_call_count",
    "time_gap_seconds",
]
TARGET_COLUMN = "fraud_label"
DATASET_PATH = Path(__file__).resolve().parent / "training_data.csv"


def create_training_data(
    output_path: Path = DATASET_PATH,
    records_per_class: int = 600,
    seed: int = 42,
) -> Path:
    """Write balanced synthetic legitimate and suspicious CDR feature records."""
    rng = random.Random(seed)
    rows = []
    base_time = datetime(2026, 1, 1)

    for label in (0, 1):
        for _ in range(records_per_class):
            if label == 1:
                call_type = rng.choices(
                    ["VOIP_SPOOFED", "OUTGOING", "INCOMING", "SMS"],
                    weights=[0.52, 0.25, 0.13, 0.10],
                )[0]
                hour = rng.choices(
                    list(range(24)),
                    weights=[4 if h in (0, 1, 2, 3, 4, 5) else 1 for h in range(24)],
                )[0]
                duration = max(1, int(rng.gauss(10, 6)))
                calls = max(2, int(rng.gauss(15, 5)))
                unique_called = max(1, int(rng.gauss(9, 3)))
                towers = max(1, min(6, int(rng.gauss(3.5, 1.3))))
                repeated = max(1, int(rng.gauss(5, 2)))
                gap = max(5, int(rng.gauss(150, 100)))
            else:
                call_type = rng.choices(
                    ["OUTGOING", "INCOMING", "SMS", "VOIP_SPOOFED"],
                    weights=[0.50, 0.25, 0.23, 0.02],
                )[0]
                hour = rng.choices(
                    list(range(24)),
                    weights=[1 if h in (0, 1, 2, 3, 4, 5) else 4 for h in range(24)],
                )[0]
                duration = max(1, int(rng.gauss(180, 80)))
                calls = max(1, int(rng.gauss(4, 2)))
                unique_called = max(1, int(rng.gauss(3, 1)))
                towers = max(1, min(4, int(rng.gauss(1.5, 0.7))))
                repeated = max(0, int(rng.gauss(1, 1)))
                gap = max(20, int(rng.gauss(1800, 700)))

            event_time = base_time + timedelta(
                days=rng.randrange(180),
                hours=hour,
                minutes=rng.randrange(60),
            )
            rows.append(
                {
                    "duration_sec": duration,
                    "call_type": call_type,
                    "hour": event_time.hour,
                    "calls_per_number": calls,
                    "unique_called_numbers": unique_called,
                    "unique_towers": towers,
                    "repeated_call_count": repeated,
                    "time_gap_seconds": gap,
                    "fraud_label": label,
                    "timestamp": event_time.isoformat(),
                }
            )

    rng.shuffle(rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=FEATURE_COLUMNS + [TARGET_COLUMN])
        writer.writeheader()
        writer.writerows(
            {column: row[column] for column in FEATURE_COLUMNS + [TARGET_COLUMN]}
            for row in rows
        )
    return output_path


if __name__ == "__main__":
    path = create_training_data()
    print(f"Created {path}")
