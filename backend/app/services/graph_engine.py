def build_graph(relationships, records=None):
    nodes = []
    edges = []

    if records is not None:
        nodes.extend(
            {
                "id": index,
                "type": "record"
            }
            for index in range(len(records))
        )

    node_ids = {node["id"] for node in nodes}

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

    