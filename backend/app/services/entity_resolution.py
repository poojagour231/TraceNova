def resolve_entities(records):
    relationships = []
    field_groups = {
        "phone": {
            "phone",
            "phone_number",
            "mobile",
            "mobile_number",
            "calling_number",
            "called_number"
        },
        "imei": {"imei", "imei_number"},
        "imsi": {"imsi", "imsi_number"},
        "ip": {
            "ip",
            "ip_address",
            "source_ip",
            "destination_ip"
        },
        "upi": {"upi", "upi_id", "upi_handle", "sender_upi", "receiver_upi"},
        "mac": {"mac", "mac_address"},
        "email": {"email", "email_address"},
        "tower": {"tower_id"},
        "bank_reference": {"bank_ref"}
    }

    for i, record in enumerate(records):
        for j in range(i + 1, len(records)):
            other_record = records[j]
            matched_entities = []

            for group, fields in field_groups.items():
                for field in fields:
                    value1 = record.get(field)
                    if not value1:
                        continue

                    for other_field in fields:
                        value2 = other_record.get(other_field)
                        if value2 and value1 == value2:
                            matched_entities.append({
                                "field": group,
                                "value": value1
                            })
                            break
                    if matched_entities and matched_entities[-1]["field"] == group:
                        break

            if matched_entities:
                relationships.append({
                    "record_1": i,
                    "record_2": j,
                    "matches": matched_entities
                })

    return relationships

    