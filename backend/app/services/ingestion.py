import csv
from pathlib import Path

from .normalization import (
    normalize_phone,
    normalize_imei,
    normalize_imsi,
    normalize_ip,
    normalize_upi,
    normalize_mac,
    normalize_email
)

BACKEND_DIR = Path(__file__).resolve().parents[2]


def resolve_evidence_path(file_path: str) -> Path:
    path = Path(file_path)

    if path.is_absolute():
        return path

    backend_path = BACKEND_DIR / path
    if backend_path.exists():
        return backend_path

    return Path.cwd() / path


def ingest_csv(file_path: str):
    path = resolve_evidence_path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"Evidence file not found: {path}")

    records = []

    field_aliases = {
        "phone": [
            "phone",
            "phone_number",
            "mobile",
            "mobile_number",
            "calling_number",
            "called_number"
        ],
        "imei": ["imei", "imei_number"],
        "imsi": ["imsi", "imsi_number"],
        "ip": ["ip", "ip_address", "source_ip", "destination_ip"],
        "upi": [
            "upi",
            "upi_id",
            "upi_handle",
            "sender_upi",
            "receiver_upi"
        ],
        "mac": ["mac", "mac_address"],
        "email": ["email", "email_address"]
    }

    with open(path, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)

        for row in reader:

            for field, aliases in field_aliases.items():

                for alias in aliases:

                    if alias in row:
                        value = row[alias]

                        if field == "phone":
                            row[alias] = normalize_phone(value)

                        elif field == "imei":
                            row[alias] = normalize_imei(value)

                        elif field == "imsi":
                            row[alias] = normalize_imsi(value)

                        elif field == "ip":
                            row[alias] = normalize_ip(value)

                        elif field == "upi":
                            row[alias] = normalize_upi(value)

                        elif field == "mac":
                            row[alias] = normalize_mac(value)

                        elif field == "email":
                            row[alias] = normalize_email(value)

                        break

            records.append(row)

    return records