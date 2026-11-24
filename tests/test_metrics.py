def test_headline_numbers(ctx):
    s = ctx.metrics.summary()
    assert (s["tickets"], s["escalated"], s["fixed"], s["avoidable"]) == (1444, 486, 211, 275)


def test_top_client_is_horizon_infotech(ctx):
    top = ctx.metrics.top_clients(3)
    assert top["top"][0]["client_name"] == "Horizon Infotech" and top["top"][0]["escalated"] == 13
    assert top["alert"] is False          # no single client is 10% of escalations


def test_handoffs_hurt(ctx):
    rows = {r["handoffs"]: r for r in ctx.metrics.bounce_rate()["by_handoffs"]}
    assert rows[0]["median_hours"] < rows[1]["median_hours"] < rows[2]["median_hours"] < rows[3]["median_hours"]
    assert rows[0]["csat"] > rows[3]["csat"]


def test_agent_with_fast_closes_reopens_most(ctx):
    karan = next(a for a in ctx.metrics.agent_scorecard() if a["agent"] == "Karan B")
    assert karan["reopen_rate"] > 0.25 and "Fast but reopened" in karan["flags"]


def test_weekly_backlog_ends_at_open_count(ctx):
    assert ctx.metrics.weekly_backlog()[-1]["open_at_end"] == 48


def test_rahul_has_many_avoidable_escalations(ctx):
    rahul = next(a for a in ctx.metrics.agent_scorecard() if a["agent"] == "Rahul T")
    assert rahul["avoidable_rate"] >= 0.65 and "Many avoidable escalations" in rahul["flags"]
