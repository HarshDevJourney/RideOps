"""Adding more months of tickets: check an uploaded CSV, merge it with what is already loaded, and report what changed.

The original CSV in backend/data is never touched. Uploaded rows are kept in their own file in the state folder and laid
on top when the app loads (a ticket ID that appears in both is taken from the upload). "Reset" deletes that file."""
import io
import json
import threading
from pathlib import Path
from typing import Optional

import pandas as pd

from app import config
from app.repository.ticket_repository import TicketRepository, end_of_day
from app.tags import CONFIG, DUPLICATE_O, FIXED, HOWTO_O, INSUFFICIENT, NOTREPRO_O

COLUMNS = ["ticket_id", "created_at", "channel", "client_id", "client_name", "client_tier", "category", "priority",
           "description", "assigned_agent", "first_response_at", "escalated_to_eng", "eng_ticket_id", "eng_handoffs",
           "eng_outcome", "status", "first_closed_at", "final_closed_at", "reopen_count", "csat_score"]
DATE_COLUMNS = ["created_at", "first_response_at", "first_closed_at", "final_closed_at"]
REQUIRED_VALUES = ["ticket_id", "created_at", "client_id", "client_name", "category", "priority", "description",
                   "assigned_agent", "escalated_to_eng", "status"]
STATUSES = {"Closed", "Open - with L1", "Open - with Engineering"}
OUTCOMES = {FIXED, INSUFFICIENT, CONFIG, DUPLICATE_O, HOWTO_O, NOTREPRO_O}
MAX_SHOWN = 12


class UploadError(ValueError):
    """The file cannot be read at all (empty, wrong encoding, too large)."""


class DataStore:
    """Where uploaded rows and the typed-in 'as of' date live on disk."""

    def __init__(self, state_dir: Path = config.STATE_DIR):
        self.dir = Path(state_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.uploaded_path, self.meta_path = self.dir / "uploaded_tickets.csv", self.dir / "data_meta.json"
        self._lock = threading.Lock()

    def uploaded(self) -> Optional[pd.DataFrame]:
        if not self.uploaded_path.exists():
            return None
        df = pd.read_csv(self.uploaded_path, dtype=str)
        return df if len(df) else None

    def as_of(self) -> Optional[str]:
        try:
            return json.loads(self.meta_path.read_text()).get("as_of")
        except (OSError, ValueError):
            return None

    def save(self, frame: pd.DataFrame, as_of: Optional[str]) -> None:
        with self._lock:
            frame.to_csv(self.uploaded_path, index=False)
            self.meta_path.write_text(json.dumps({"as_of": as_of}))

    def reset(self) -> None:
        with self._lock:
            for p in (self.uploaded_path, self.meta_path):
                p.unlink(missing_ok=True)


def _row(i) -> int:
    return int(i) + 2          # spreadsheet row number: header is row 1, first ticket is row 2


def read_upload(raw: bytes) -> pd.DataFrame:
    if not raw.strip():
        raise UploadError("The file is empty.")
    if len(raw) > config.MAX_UPLOAD_BYTES:
        raise UploadError(f"The file is larger than {config.MAX_UPLOAD_BYTES // (1024 * 1024)} MB. Upload one month at a time.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise UploadError("The file is not UTF-8 text. In Excel use Save As, CSV UTF-8.")
    try:
        df = pd.read_csv(io.StringIO(text), dtype=str)
    except (pd.errors.EmptyDataError, pd.errors.ParserError) as e:
        raise UploadError(f"This does not look like a CSV file ({str(e)[:120]}).")
    df.columns = [str(c).strip() for c in df.columns]
    return df


def check_rows(df: pd.DataFrame, known_categories: set) -> dict:
    """Validate and clean an uploaded table. Returns {'clean', 'errors', 'warnings'}; the file is usable when errors is empty."""
    errors, warnings = [], []
    add = lambda bucket, rows, column, msg: bucket.extend({"row": _row(i), "column": column, "message": msg} for i in rows)

    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        errors.append({"row": None, "column": ", ".join(missing), "message": "These columns are missing. Download the template to see the expected columns."})
        return {"clean": None, "errors": errors, "warnings": warnings}
    extra = [c for c in df.columns if c not in COLUMNS]
    if extra:
        warnings.append({"row": None, "column": ", ".join(extra), "message": "Extra columns are ignored."})

    d = df[COLUMNS].apply(lambda s: s.astype("string").str.strip().astype(object))
    d = d.mask(d.eq("")).where(d.notna(), None)      # blank cells (and cells with only spaces) become missing values
    if d.empty:
        errors.append({"row": None, "column": None, "message": "The file has a header but no tickets."})
        return {"clean": None, "errors": errors, "warnings": warnings}

    for c in REQUIRED_VALUES:
        add(errors, d.index[d[c].isna() | d[c].eq("")], c, "This value is required.")
    dup = d.ticket_id.notna() & d.ticket_id.duplicated(keep=False)
    add(errors, d.index[dup], "ticket_id", "This ticket ID appears more than once in the file.")

    dates = {}
    for c in DATE_COLUMNS:
        dates[c] = pd.to_datetime(d[c], errors="coerce")
        add(errors, d.index[d[c].notna() & d[c].ne("") & dates[c].isna()], c, "Not a date. Use a form like 2026-10-05 14:30.")
    add(errors, d.index[~d.priority.isin(["P1", "P2", "P3", "P4"]) & d.priority.notna()], "priority", "Use P1, P2, P3 or P4.")
    add(errors, d.index[~d.escalated_to_eng.isin(["Yes", "No"]) & d.escalated_to_eng.notna()], "escalated_to_eng", "Use Yes or No.")
    add(errors, d.index[~d.status.isin(STATUSES) & d.status.notna()], "status", "Use Closed, Open - with L1 or Open - with Engineering.")
    for c in ("eng_handoffs", "reopen_count"):
        n = pd.to_numeric(d[c], errors="coerce")
        bad = d[c].notna() & ((n.isna()) | (n < 0) | (n != n.round()))
        add(errors, d.index[bad], c, "Use a whole number, 0 or more.")
    csat = pd.to_numeric(d.csat_score, errors="coerce")
    add(errors, d.index[d.csat_score.notna() & (csat.isna() | (csat < 1) | (csat > 5))], "csat_score", "Use a score from 1 to 5, or leave blank.")

    closed = d.status.eq("Closed")
    add(errors, d.index[closed & dates["final_closed_at"].isna()], "final_closed_at", "A Closed ticket needs a final close time.")
    add(errors, d.index[d.status.str.startswith("Open", na=False) & dates["final_closed_at"].notna()], "final_closed_at",
        "The status says open but there is a close time.")
    add(errors, d.index[dates["final_closed_at"] < dates["created_at"]], "final_closed_at", "Closed before it was created.")

    add(warnings, d.index[d.eng_outcome.notna() & ~d.eng_outcome.isin(OUTCOMES)], "eng_outcome",
        "Unknown engineering outcome. It will count as avoidable (anything but Fixed).")
    add(warnings, d.index[d.eng_outcome.notna() & d.escalated_to_eng.eq("No")], "eng_outcome", "Has an outcome but is marked not escalated.")
    new_cats = sorted(set(d.category.dropna()) - known_categories)
    if new_cats:
        warnings.append({"row": None, "column": "category", "message": "New categories (they work, but have no 'details to have ready' checklist): " + "; ".join(new_cats)})
    if errors:
        return {"clean": None, "errors": sorted(errors, key=lambda e: (e["row"] or 0, e["column"] or "")), "warnings": warnings}

    clean = d.copy()
    for c in DATE_COLUMNS:
        clean[c] = dates[c].dt.strftime("%Y-%m-%d %H:%M")
    for c in ("eng_handoffs", "reopen_count"):
        clean[c] = pd.to_numeric(clean[c]).fillna(0).astype(int).astype(str)
    clean["csat_score"] = pd.to_numeric(clean.csat_score).map(lambda v: "" if pd.isna(v) else f"{v:g}")
    return {"clean": clean.fillna(""), "errors": errors, "warnings": warnings}


class DataService:
    def __init__(self, store: DataStore, base_path: Path = config.DATA_PATH):
        self.store, self.base_path = store, Path(base_path)

    def window(self, repo: TicketRepository) -> dict:
        months = {}
        for t in repo.all():
            months[t.created_at.strftime("%Y-%m")] = months.get(t.created_at.strftime("%Y-%m"), 0) + 1
        return {"tickets": len(repo.all()), "open": len(repo.open_queue()), "first_date": repo.first_day.date().isoformat(),
                "last_created": max(t.created_at for t in repo.all()).date().isoformat(), "as_of": repo.as_of.isoformat(timespec="minutes"),
                "as_of_is_manual": repo.as_of_is_manual, "months": [{"month": k, "tickets": v} for k, v in sorted(months.items())]}

    def status(self, repo: TicketRepository) -> dict:
        up = self.store.uploaded()
        return {**self.window(repo), "uploaded_tickets": 0 if up is None else len(up), "columns": COLUMNS,
                "original_tickets": int(len(pd.read_csv(self.base_path, usecols=["ticket_id"])))}

    def inspect(self, raw: bytes, repo: TicketRepository, as_of: Optional[str]) -> dict:
        """Check a file and say what applying it would do. Nothing is saved."""
        if as_of:
            try:
                pd.Timestamp(as_of)
            except ValueError:
                raise UploadError("The 'data pulled on' date is not a valid date.")
        df = read_upload(raw)
        known = {t.category for t in repo.all()}
        res = check_rows(df, known)
        report = {"rows": int(len(df)), "errors": res["errors"][:MAX_SHOWN], "error_count": len(res["errors"]),
                  "warnings": res["warnings"][:MAX_SHOWN], "warning_count": len(res["warnings"]), "ok": not res["errors"]}
        if res["errors"]:
            return {**report, "clean": None}
        clean = res["clean"]
        existing = {t.ticket_id for t in repo.all()}
        replaced = int(clean.ticket_id.isin(existing).sum())
        merged_upload = self._merge_uploads(clean)
        preview = TicketRepository().load_csv(self.base_path, extra=merged_upload, as_of=as_of or None)
        if as_of and end_of_day(as_of) < preview.latest_event:
            report.update(ok=False, error_count=1, errors=[{"row": None, "column": "as_of", "message":
                f"The 'data pulled on' date is earlier than the latest ticket activity ({preview.latest_event:%d %b %Y}). Use that date or later."}])
            return {**report, "clean": None}
        loaded_to = max(t.created_at for t in repo.all())
        gap = (pd.Timestamp(clean.created_at.min()) - pd.Timestamp(loaded_to)).days
        if gap > 7:
            report["warnings"].append({"row": None, "column": "created_at", "message":
                f"There is a gap: the loaded data ends on {loaded_to:%d %b} and this file starts on {pd.Timestamp(clean.created_at.min()):%d %b}. "
                "The weekly charts will show empty weeks in between. Upload the missing days too if you have them."})
            report["warning_count"] += 1
        before = {m["month"]: m["tickets"] for m in self.window(repo)["months"]}
        after = self.window(preview)
        report.update(new_tickets=int(len(clean) - replaced), replaced_tickets=replaced,
                      file_from=str(clean.created_at.min())[:10], file_to=str(clean.created_at.max())[:10],
                      before={"tickets": len(repo.all()), "as_of": repo.as_of.isoformat(timespec="minutes"), "open": len(repo.open_queue())},
                      after=after, months=[{**m, "was": before.get(m["month"], 0)} for m in after["months"]])
        return {**report, "clean": merged_upload}

    def _merge_uploads(self, clean: pd.DataFrame) -> pd.DataFrame:
        old = self.store.uploaded()
        both = clean if old is None else pd.concat([old, clean], ignore_index=True)
        return both.drop_duplicates("ticket_id", keep="last").reset_index(drop=True)
