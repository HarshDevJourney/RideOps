"""Datasets: uploads are files in a folder, the app analyses the ones that are ticked, and follows the folder."""
import os

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import create_app
from app.services.data_service import check_rows

DATE_COLS = ["created_at", "first_response_at", "first_closed_at", "final_closed_at"]


@pytest.fixture()
def env(tmp_path):
    """A client with its own folders, so one test never leaks into another."""
    uploads = tmp_path / "uploads"
    with TestClient(create_app(state_dir=tmp_path / "state", uploads_dir=uploads)) as c:
        c.uploads = uploads
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


def post(client, df, name="october.csv", **params):
    return client.post("/api/data/upload", params={"name": name, **params}, content=csv_bytes(df), headers={"Content-Type": "text/csv"})


def tickets(client) -> int:
    return client.get("/api/health").json()["tickets"]


def ids(client):
    return {d["id"]: d for d in client.get("/api/data/status").json()["datasets"]}


def test_the_original_file_passes_its_own_validator():
    assert check_rows(base(), set(config.REQUIRED_INFO))["errors"] == []


def test_the_original_is_listed_and_in_use_at_the_start(env):
    d = ids(env)
    assert list(d) == ["original"] and d["original"]["selected"] and d["original"]["tickets"] == 1444
    assert (d["original"]["first"], d["original"]["last"]) == ("2026-07-02", "2026-09-30")
    assert env.get("/api/data/status").json()["folder"] == "data/uploads"


def test_dry_run_reports_but_saves_nothing(env):
    rep = post(env, october(), dry_run="true").json()
    assert rep["ok"] and rep["applied"] is False and rep["saved_as"] is None
    assert rep["new_tickets"] == 120 and rep["after"]["tickets"] == 1564 and rep["after"]["as_of"].startswith("2026-10-31")
    assert list(env.uploads.glob("*.csv")) == [] and tickets(env) == 1444


def test_applying_saves_a_file_in_the_folder_and_every_page_follows(env):
    rep = post(env, october(), dry_run="false").json()
    assert rep["applied"] and rep["saved_as"] == "october.csv"
    assert (env.uploads / "october.csv").exists()
    assert tickets(env) == 1564 and ids(env)["october.csv"]["selected"]
    meta = env.get("/api/meta").json()
    assert meta["as_of"].startswith("2026-10-31") and meta["default_split"] == "2026-10-01"
    assert meta["datasets"] == ["Original data", "october.csv"]
    assert [m["month"] for m in env.get("/api/metrics/summary").json()["monthly"]] == ["Jul", "Aug", "Sep", "Oct"]
    trend = env.get("/api/metrics/category-trend").json()
    assert (trend["first_label"], trend["last_label"]) == ("Jul", "Oct")
    assert env.get("/api/backtest").status_code == 200
    weeks = env.get("/api/metrics/weekly").json()
    assert weeks[-1]["week"] == "26 Oct" and weeks[-1]["open_at_end"] == env.get("/api/queue").json()["totals"]["open"]


def test_deleting_the_file_from_the_folder_stops_it_being_used(env):
    post(env, october(), dry_run="false")
    assert tickets(env) == 1564
    os.remove(env.uploads / "october.csv")                 # what a person does in the file explorer
    assert tickets(env) == 1444 and list(ids(env)) == ["original"]
    assert env.get("/api/meta").json()["as_of"].startswith("2026-09-30")


def test_a_csv_dropped_into_the_folder_by_hand_is_picked_up(env):
    october().to_csv(env.uploads / "dropped_in.csv", index=False)
    assert ids(env)["dropped_in.csv"]["status"] == "ok" and tickets(env) == 1564


def test_a_broken_file_in_the_folder_is_listed_but_never_used(env):
    bad = october(5)
    bad.loc[bad.index[1], "priority"] = "P9"
    bad.to_csv(env.uploads / "broken.csv", index=False)
    d = ids(env)["broken.csv"]
    assert d["status"] == "problem" and not d["selected"] and "priority" in d["problems"][0]
    assert tickets(env) == 1444                             # the app still works on the good data
    assert env.put("/api/data/selection", json={"selected": ["original", "broken.csv"]}).status_code in (200, 422)
    assert tickets(env) == 1444


def test_choosing_which_datasets_to_analyse(env):
    post(env, october(), dry_run="false")
    st = env.put("/api/data/selection", json={"selected": ["october.csv"]}).json()      # only October
    assert [d["selected"] for d in st["datasets"]] == [False, True] and tickets(env) == 120
    assert [m["month"] for m in env.get("/api/metrics/summary").json()["monthly"]] == ["Oct"]
    assert env.get("/api/data/status").json()["current"]["first_date"] == "2026-10-26"
    env.put("/api/data/selection", json={"selected": ["original"]})                     # only July to September
    assert tickets(env) == 1444 and env.get("/api/meta").json()["as_of"].startswith("2026-09-30")
    env.put("/api/data/selection", json={"selected": ["original", "october.csv"]})
    assert tickets(env) == 1564


def test_at_least_one_dataset_must_stay_chosen(env):
    r = env.put("/api/data/selection", json={"selected": []})
    assert r.status_code == 422 and tickets(env) == 1444
    assert env.put("/api/data/selection", json={"selected": ["nope.csv"]}).status_code == 422


def test_the_newest_file_wins_for_the_same_ticket_id_so_open_tickets_can_close(env):
    row = base().query("ticket_id == 'SUP-11296'").copy()
    assert env.get("/api/queue").json()["totals"]["open"] == 48
    row["status"], row["final_closed_at"], row["first_closed_at"] = "Closed", "2026-10-02 10:00", "2026-10-02 10:00"
    rep = post(env, row, name="closed.csv", dry_run="false").json()
    assert rep["new_tickets"] == 0 and rep["replaced_tickets"] == 1
    assert env.get("/api/queue").json()["totals"]["open"] == 47 and tickets(env) == 1444
    env.put("/api/data/selection", json={"selected": ["original"]})                      # untick it: the ticket is open again
    assert env.get("/api/queue").json()["totals"]["open"] == 48


def test_the_same_file_name_twice_makes_a_second_file(env):
    post(env, october(), dry_run="false")
    assert post(env, october(), dry_run="false").json()["saved_as"] == "october-2.csv"
    assert tickets(env) == 1564                              # same ticket IDs, so nothing is counted twice


def test_deleting_an_upload_from_the_app(env):
    post(env, october(), dry_run="false")
    st = env.delete("/api/data/datasets/october.csv").json()
    assert [d["id"] for d in st["datasets"]] == ["original"] and not (env.uploads / "october.csv").exists() and tickets(env) == 1444
    assert env.delete("/api/data/datasets/october.csv").status_code == 404
    assert env.delete("/api/data/datasets/original").status_code == 422
    assert env.delete("/api/data/datasets/..%2Fsecret.csv").status_code in (404, 422)


def test_if_the_only_ticked_file_is_deleted_nothing_is_in_use_until_you_tick_something(env):
    post(env, october(), dry_run="false")
    env.put("/api/data/selection", json={"selected": ["october.csv"]})
    os.remove(env.uploads / "october.csv")                   # the only ticked file disappears
    assert tickets(env) == 0 and env.get("/api/queue").status_code == 503
    st = env.get("/api/data/status").json()                  # the Data page still works, and the original is there to tick
    assert [(d["id"], d["selected"]) for d in st["datasets"]] == [("original", False)] and st["current"] is None
    env.put("/api/data/selection", json={"selected": ["original"]})
    assert tickets(env) == 1444


def test_nothing_chosen_returns_a_clear_message(env, tmp_path):
    empty = tmp_path / "none.csv"
    with TestClient(create_app(state_dir=tmp_path / "s2", uploads_dir=tmp_path / "u2", data_path=empty)) as c:
        assert c.get("/api/health").json()["tickets"] == 0
        r = c.get("/api/queue")
        assert r.status_code == 503 and "Add data" in r.json()["detail"]
        st = c.get("/api/data/status").json()
        assert st["datasets"] == [] and st["current"] is None
        assert post(c, october(), dry_run="false").json()["applied"]          # and you can upload your way out of it
        assert c.get("/api/health").json()["tickets"] == 120


def test_errors_name_the_row_and_column_and_block_adding(env):
    bad = october(5)
    bad.loc[bad.index[1], "priority"] = "P9"
    bad.loc[bad.index[2], "created_at"] = "yesterday"
    bad.loc[bad.index[3], "status"] = "Closed"
    bad.loc[bad.index[3], "final_closed_at"] = None
    rep = post(env, bad, dry_run="true").json()
    assert not rep["ok"] and rep["error_count"] == 3
    assert [(e["row"], e["column"]) for e in rep["errors"]] == [(3, "priority"), (4, "created_at"), (5, "final_closed_at")]
    assert post(env, bad, dry_run="false").status_code == 422
    assert list(env.uploads.glob("*.csv")) == [] and tickets(env) == 1444


def test_missing_columns_duplicates_and_bad_files(env):
    r = post(env, october(5).drop(columns=["priority", "category"]), dry_run="true").json()
    assert not r["ok"] and "priority" in r["errors"][0]["column"] and "category" in r["errors"][0]["column"]
    assert not post(env, pd.concat([october(3), october(3)]), dry_run="true").json()["ok"]
    assert env.post("/api/data/upload", content=b"", headers={"Content-Type": "text/csv"}).status_code == 422
    assert env.post("/api/data/upload", content=b"\xff\xfe\x00bad", headers={"Content-Type": "text/csv"}).status_code == 422


def test_a_gap_between_loaded_data_and_the_file_is_warned_about(env):
    rep = post(env, october(), dry_run="true").json()          # the fake file starts 26 Oct, loaded data ends 30 Sep
    assert rep["ok"] and any("gap" in w["message"] for w in rep["warnings"])


def test_the_data_pulled_on_date_is_used_but_never_earlier_than_the_data(env):
    post(env, october(), dry_run="false")
    env.put("/api/data/selection", json={"as_of": "2026-11-02"})
    assert env.get("/api/meta").json()["as_of"].startswith("2026-11-02")
    assert env.get("/api/data/status").json()["current"]["as_of_is_manual"] is True
    env.put("/api/data/selection", json={"as_of": "2026-10-05"})                          # earlier than the latest activity: ignored
    assert env.get("/api/meta").json()["as_of"].startswith("2026-10-31")
    env.put("/api/data/selection", json={"as_of": None})
    assert env.get("/api/data/status").json()["as_of_setting"] is None
    assert env.put("/api/data/selection", json={"as_of": "not a date"}).status_code == 422


def test_unknown_values_are_warnings_not_errors(env):
    d = october(4)
    d["category"] = "Brand new category"
    rep = post(env, d, dry_run="true").json()
    assert rep["ok"] and rep["warning_count"] >= 1
    assert post(env, d, dry_run="false").json()["applied"] and env.get("/api/queue").status_code == 200


def test_file_names_are_made_safe(env):
    assert post(env, october(3), name="../../etc/My Tickets (Oct).csv", dry_run="false").json()["saved_as"] == "My_Tickets_Oct.csv"
    assert [p.name for p in env.uploads.glob("*")] == ["My_Tickets_Oct.csv"]
