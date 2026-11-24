from app.tags import *  # noqa


def tags(ctx, tid):
    return set(ctx.triage.assess(ctx.repo.get(tid)).tags)


def test_returned_for_info_and_bouncing(ctx):
    assert {LACK_OF_INFO, BOUNCING, REOPENED} <= tags(ctx, "SUP-11296")


def test_duplicate_and_config(ctx):
    assert DUPLICATE in tags(ctx, "SUP-11379")
    assert CONFIG_CHECK in tags(ctx, "SUP-11258")


def test_fix_ready(ctx):
    assert FIX_READY in tags(ctx, "SUP-11366")


def test_number_variants_match_same_issue(ctx):
    from app.checks.known_issue_matcher import normalize
    assert normalize("Roster shows duplicate entries for 16 employees") == normalize("Roster shows duplicate entries for 4 employees")


def test_gate_clears_when_info_provided(ctx):
    from app.models.ticket import Ticket
    from app import config
    cat = "Live tracking / GPS incorrect"
    base = dict(ticket_id="X", created_at=config.AS_OF, client_id="", client_name="", category=cat,
                priority="P3", description="Cab location frozen on map for last 20 mins")
    missing = ctx.triage.assess(Ticket(**base)).details["missing_info"]
    full = ctx.triage.assess(Ticket(**base, info_provided=list(config.REQUIRED_INFO[cat])))
    assert missing and COLLECT_INFO_FIRST not in full.tags and full.details["missing_info"] == []


def test_p1_is_never_held(ctx):
    for t in ctx.repo.open_queue():
        if t.priority == "P1":
            assert ctx.triage.assess(t.masked()).hold_escalation is False
