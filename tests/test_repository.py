def test_row_counts(ctx):
    assert len(ctx.repo.all()) == 1444
    assert len(ctx.repo.open_queue()) == 48


def test_open_split(ctx):
    open_ = ctx.repo.open_queue()
    assert sum(t.status == "Open - with L1" for t in open_) == 29
    assert sum(t.status == "Open - with Engineering" for t in open_) == 19
