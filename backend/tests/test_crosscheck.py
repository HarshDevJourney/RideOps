"""Independent recomputation straight from the raw CSV, so a bug in our own loaders cannot hide."""
import pandas as pd
import pytest

from app import config


@pytest.fixture(scope="module")
def raw():
    df = pd.read_csv(config.DATA_PATH, parse_dates=["created_at", "final_closed_at"])
    df["esc"] = df.escalated_to_eng.eq("Yes")
    return df


def test_summary_matches_raw(ctx, raw):
    s = ctx.metrics.summary()
    esc = raw[raw.esc]
    assert s["tickets"] == len(raw) and s["escalated"] == len(esc)
    assert s["fixed"] == int((esc.eng_outcome == "Fixed").sum())
    assert s["open"] == int((raw.status != "Closed").sum()) == 48
    assert [m["tickets"] for m in s["monthly"]] == [390, 462, 592]


def test_weekly_created_adds_up(ctx, raw):
    assert sum(r["created"] for r in ctx.metrics.weekly_backlog()) == len(raw)
    assert sum(r["closed"] for r in ctx.metrics.weekly_backlog()) == int(raw.final_closed_at.notna().sum())


def test_success_weeks_cover_all_tickets(ctx):
    s = ctx.metrics.success()
    assert sum(r["tickets"] for r in s["weekly"]) == 1444
    assert [r["partial"] for r in s["weekly"]][0] and [r["partial"] for r in s["weekly"]][-1]
    assert len(s["baseline_weeks"]) == 4 and len(s["latest_weeks"]) == 4


def test_category_trend_adds_up(ctx):
    trend = ctx.metrics.category_trend()
    assert sum(sum(r["by_month"].values()) for r in trend["rows"]) == 1444
    assert (trend["first_label"], trend["last_label"]) == ("Jul", "Sep")
    top = trend["rows"][0]
    assert (top["category"], top["first"], top["last"], top["change"]) == ("Cab delay / no-show complaint", 29, 72, 43)


def test_every_open_ticket_gets_a_verdict_with_an_action(ctx):
    for t, v in ctx.triage.tag_queue(ctx.repo.open_queue()):
        assert v.action and v.reason and isinstance(v.tags, list)


def test_engineering_answered_tickets_are_tagged(ctx):
    """Every open ticket whose engineering outcome is a 'returned' type must carry the matching tag."""
    from app.tags import L1_ACTION_TAGS
    for t, v in ctx.triage.tag_queue(ctx.repo.open_queue()):
        if t.eng_outcome:
            assert L1_ACTION_TAGS & set(v.tags), (t.ticket_id, t.eng_outcome, v.tags)
