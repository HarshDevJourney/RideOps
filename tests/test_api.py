def test_queue(client):
    q = client.get("/api/queue").json()
    assert q["totals"]["open"] == 48 and len(q["items"]) == 48
    assert q["items"][0]["priority"] == "P1"


def test_unknown_ticket_is_404(client):
    assert client.get("/api/tickets/NOPE").status_code == 404


def test_manual_triage_and_feedback(client):
    r = client.post("/api/triage", json={"category": "Report export failing", "description": "Scheduled report email not received"})
    assert r.status_code == 200 and r.json()["verdict"]["action"]
    assert client.post("/api/feedback", json={"ticket_id": "SUP-11296", "agree": True}).json()["agree"] is True
    assert client.get("/api/feedback/summary").json()["total"] >= 1


def test_frontend_is_served(client):
    assert client.get("/").status_code == 200


def test_queue_reports_how_many_need_l1_action(client):
    totals = client.get("/api/queue").json()["totals"]
    assert totals["l1_action"] == 34 and totals["l1_action"] <= totals["open"]


def test_validation_errors_are_clear(client):
    bad = client.post("/api/triage", json={"category": "Report export failing", "description": "   "})
    assert bad.status_code == 422
    assert client.post("/api/triage", json={"category": "Nope", "description": "something broke"}).status_code == 422
    assert client.post("/api/triage", json={"category": "Report export failing", "description": "ok then", "priority": "P9"}).status_code == 422
    assert client.post("/api/feedback", json={"ticket_id": "NOPE", "agree": True}).status_code == 404
    assert client.get("/api/backtest?split=2026-01-01").status_code == 422
    assert client.get("/api/backtest?split=banana").status_code == 422
    assert client.get("/api/metrics/top-clients?n=99").status_code == 422


def test_every_endpoint_responds(client):
    for path in ["/api/meta", "/api/queue", "/api/metrics/summary", "/api/metrics/weekly", "/api/metrics/yield", "/api/metrics/bounce",
                 "/api/metrics/agents", "/api/metrics/categories", "/api/metrics/top-clients", "/api/metrics/success",
                 "/api/metrics/category-trend", "/api/backtest", "/api/feedback/summary", "/api/tickets/SUP-11296"]:
        r = client.get(path)
        assert r.status_code == 200, path
