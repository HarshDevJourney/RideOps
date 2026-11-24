from datetime import datetime


def test_no_leakage(ctx):
    r = ctx.backtester.run("2026-09-01")
    split = datetime(2026, 9, 1)
    assert r["train_size"] == len(ctx.repo.before(split))
    assert r["test_escalations"] == sum(t.escalated for t in ctx.repo.on_or_after(split))


def test_masked_ticket_hides_the_future(ctx):
    t = next(t for t in ctx.repo.all() if t.escalated and t.eng_outcome)
    m = t.masked()
    assert m.eng_outcome is None and m.eng_handoffs == 0 and not m.escalated and m.reopen_count == 0


def test_counts_add_up(ctx):
    r = ctx.backtester.run("2026-09-01")
    assert r["caught"] + r["wrongly_flagged"] == r["flagged"]
    assert r["caught"] + r["missed"] == r["avoidable_total"]
