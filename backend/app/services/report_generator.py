from typing import Any, Mapping


def generate_investigation_report(
    analysis_result: Mapping[str, Any]
) -> dict[str, Any]:
    """Build a structured investigation report from an analysis response."""
    relationships = list(analysis_result.get("relationships", []))
    graph = analysis_result.get("graph") or {}
    nodes = list(graph.get("nodes", []))
    edges = list(graph.get("edges", []))
    risk = analysis_result.get("risk", 0)
    risk_summary = dict(analysis_result.get("risk_summary") or {})
    ml_predictions = list(analysis_result.get("ml_predictions") or [])

    return {
        "case_id": analysis_result.get("case_id"),
        "records_analyzed": analysis_result.get("records_analyzed", 0),
        "risk": risk,
        "risk_summary": {
            "low": risk_summary.get("low", 0),
            "medium": risk_summary.get("medium", 0),
            "high": risk_summary.get("high", 0),
        },
        "fraud_probability": analysis_result.get("fraud_probability"),
        "risk_level": analysis_result.get("risk_level"),
        "ml_predictions": ml_predictions,
        "cdr_records_used": len(ml_predictions),
        "relationships": relationships,
        "graph": {
            "nodes": nodes,
            "edges": edges,
        },
        "investigation_summary": {
            "risk_level": _risk_level(risk),
            "relationship_count": len(relationships),
            "graph_node_count": len(nodes),
            "graph_edge_count": len(edges),
            "finding": _finding(len(relationships), len(edges)),
        },
    }


def _risk_level(risk: Any) -> str:
    try:
        score = float(risk)
    except (TypeError, ValueError):
        score = 0

    if score < 34:
        return "low"
    if score < 67:
        return "medium"
    return "high"


def _finding(relationship_count: int, edge_count: int) -> str:
    if relationship_count == 0 or edge_count == 0:
        return "No linked entities were detected in the analyzed evidence."

    return (
        f"Detected {relationship_count} linked relationship(s) "
        f"across {edge_count} graph edge(s)."
    )
