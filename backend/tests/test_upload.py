"""Adding more months of tickets: checking, merging, reloading and resetting."""
import io

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import create_app
from app.services.data_service import COLUMNS, check_rows

DATE_COLS = ["created_at", "first_response_at", "first_closed_at", "final_closed_at"]


@pytest.fixture()
def fresh(tmp_path):
    """A client with its own empty state folder, so uploads in one test never leak into another."""
    with TestClient(create_app(state_dir=tmp_path)) as c:
        yield c


def base() -> pd.DataFrame:
    return pd.read_csv(config.DATA_PATH, dtype=str)


def october(n=120) -> pd.DataFrame:
    """Pretend October: the last n September tickets, moved forward by 31 days with new IDs."""
    d = base()
    d = d[d.created_at >= "2026-09-01"].tail(n).copy()
    for c in DATE_COLS:
        d[c] = (pd.to_datetime(d[c]) + pd.Timedelta(days=31)).dt.strftime("%Y-%m-%d %H:%M")
    d["ticket_id"] = [f"SUP-2{i:04d}" for i in range(len(d))]
    return d


def csv_bytes(df: pd.DataFrame) -> bytes:
    return df.to_csv(index=False).encode()


def post(client, df, **params):
    return client.post("/api/data/upload", params=params, content=csv_bytes(df), headers={"Content-Type": "text/csv"})


def test_the_original_file_passes_its_own_validator():
    res = check_rows(base(), set(config.REQUIRED_INFO))
    assert res["errors"] == []


def test_dry_run_reports_but_changes_nothing(fresh):
    r = post(fresh, october(), dry_run="true")
    assert r.status_code == 200
    rep = r.json()
    assert rep["ok"] and rep["applied"] is False
    assert rep["rows"] == 120 and rep["new_tickets"] == 120 and rep["replaced_tickets"] == 0
    assert rep["after"]["tickets"] == 1444 + 120 and rep["after"]["as_of"].startswith("2026-10-31")
    assert fresh.get("/api/health").json()["tickets"] == 1444                  # nothing was saved


def test_a_gap_between_loaded_data_and_the_file_is_warned_about(fresh):
    rep = post(fresh, october(), dry_run="true").json()          # the fake file starts 26 Oct, loaded data ends 30 Sep
    assert rep["ok"] and any("gap" in w["message"] for w in rep["warnings"])


def test_applying_adds_a_month_and_every_page_follows(fresh):
    assert post(fresh, october(), dry_run="false").json()["applied"] is True
    assert fresh.get("/api/health").json()["tickets"] == 1444 + 120
    meta = fresh.get("/api/meta").json()
    assert meta["as_of"].startswith("2026-10-31") and meta["default_split"] == "2026-10-01" and meta["split_max"] == "2026-10-26"
    months = [m["month"] for m in fresh.get("/api/metrics/summary").json()["monthly"]]
    assert months == ["Jul", "Aug", "Sep", "Oct"]
    trend = fresh.get("/api/metrics/category-trend").json()
    assert (trend["first_label"], trend["last_label"]) == ("Jul", "Oct")
    assert fresh.get("/api/backtest").status_code == 200                        # default date moved with the data
    assert fresh.get("/api/backtest?split=2026-10-01").json()["test_escalations"] > 0
    weeks = fresh.get("/api/metrics/weekly").json()
    assert weeks[-1]["week"] == "26 Oct" and weeks[-1]["open_at_end"] == fresh.get("/api/queue").json()["totals"]["open"]
    assert fresh.get("/api/data/status").json()["uploaded_tickets"] == 120


def test_an_existing_id_is_replaced_so_open_tickets_can_close(fresh):
    row = base().query("ticket_id == 'SUP-11296'").copy()
    assert fresh.get("/api/queue").json()["totals"]["open"] == 48
    row["status"], row["final_closed_at"], row["first_closed_at"] = "Closed", "2026-10-02 10:00", "2026-10-02 10:00"
    rep = post(fresh, row, dry_run="false").json()
    assert rep["new_tickets"] == 0 and rep["replaced_tickets"] == 1
    assert fresh.get("/api/queue").json()["totals"]["open"] == 47
    assert fresh.get("/api/health").json()["tickets"] == 1444


def test_uploading_twice_does_not_double_count(fresh):
    post(fresh, october(), dry_run="false")
    post(fresh, october(), dry_run="false")
    assert fresh.get("/api/health").json()["tickets"] == 1444 + 120


def test_reset_goes_back_to_the_original_data(fresh):
    post(fresh, october(), dry_run="false")
    r = fresh.delete("/api/data/upload")
    assert r.status_code == 200 and r.json()["tickets"] == 1444 and r.json()["uploaded_tickets"] == 0
    assert fresh.get("/api/meta").json()["as_of"].startswith("2026-09-30")


def test_errors_name_the_row_and_column_and_block_applying(fresh):
    bad = october(5)
    bad.loc[bad.index[1], "priority"] = "P9"
    bad.loc[bad.index[2], "created_at"] = "yesterday"
    bad.loc[bad.index[3], "status"] = "Closed"
    bad.loc[bad.index[3], "final_closed_at"] = None
    rep = post(fresh, bad, dry_run="true").json()
    assert not rep["ok"] and rep["error_count"] == 3
    assert [(e["row"], e["column"]) for e in rep["errors"]] == [(3, "priority"), (4, "created_at"), (5, "final_closed_at")]   # in row order
    assert post(fresh, bad, dry_run="false").status_code == 422
    assert fresh.get("/api/health").json()["tickets"] == 1444


def test_missing_columns_duplicates_and_bad_files(fresh):
    r = post(fresh, october(5).drop(columns=["priority", "category"]), dry_run="true").json()
    assert not r["ok"] and "priority" in r["errors"][0]["column"] and "category" in r["errors"][0]["column"]
    dup = pd.concat([october(3), october(3)])
    assert not post(fresh, dup, dry_run="true").json()["ok"]
    assert fresh.post("/api/data/upload", content=b"", headers={"Content-Type": "text/csv"}).status_code == 422
    assert fresh.post("/api/data/upload", content=b"\xff\xfe\x00bad", headers={"Content-Type": "text/csv"}).status_code == 422


def test_typed_as_of_date_is_used_and_cannot_be_earlier_than_the_data(fresh):
    ok = post(fresh, october(), dry_run="false", as_of="2026-11-02").json()
    assert ok["applied"] and fresh.get("/api/meta").json()["as_of"].startswith("2026-11-02")
    assert fresh.get("/api/data/status").json()["as_of_is_manual"] is True
    early = post(fresh, october(), dry_run="true", as_of="2026-10-05").json()
    assert not early["ok"] and early["errors"][0]["column"] == "as_of"


def test_unknown_values_are_warnings_not_errors(fresh):
    d = october(4)
    d["category"] = "Brand new category"
    rep = post(fresh, d, dry_run="true").json()
    assert rep["ok"] and rep["warning_count"] >= 1
    assert post(fresh, d, dry_run="false").json()["applied"]
    assert fresh.get("/api/queue").status_code == 200                           # new category does not break the queue
