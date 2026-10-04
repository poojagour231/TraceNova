def calculate_risk(records):
    """
    Calculate the average risk score across all analyzed records.
    """

    risk_scores = _extract_scores(records)

    if not risk_scores:
        return 0

    return round(sum(risk_scores) / len(risk_scores), 2)


def _extract_scores(records):
    scores = []

    for record in records:
        if not isinstance(record, dict):
            continue

        raw_score = record.get("risk_score")
        if raw_score in (None, ""):
            raw_score = record.get("fraud_score")
            multiplier = 100
        else:
            multiplier = 1

        try:
            score = float(raw_score) * multiplier
        except (TypeError, ValueError):
            continue

        scores.append(max(0, min(score, 100)))

    return scores


def get_risk_summary(records):
    summary = {
        "low": 0,
        "medium": 0,
        "high": 0
    }

    for score in _extract_scores(records):
        if score < 34:
            summary["low"] += 1
        elif score < 67:
            summary["medium"] += 1
        else:
            summary["high"] += 1

    return summary


def build_graph(relationships):
    nodes = []
    edges = []

    node_ids = set()

    for relationship in relationships:

        record_1 = relationship["record_1"]
        record_2 = relationship["record_2"]

        if record_1 not in node_ids:
            nodes.append({
                "id": record_1,
                "type": "record"
            })
            node_ids.add(record_1)

        if record_2 not in node_ids:
            nodes.append({
                "id": record_2,
                "type": "record"
            })
            node_ids.add(record_2)

        for match in relationship["matches"]:

            edges.append({
                "source": record_1,
                "target": record_2,
                "entity_type": match["field"],
                "value": match["value"]
            })

    return {
        "nodes": nodes,
        "edges": edges
    }