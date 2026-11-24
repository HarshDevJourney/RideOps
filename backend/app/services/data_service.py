"""Ticket datasets: the original CSV plus every CSV in the uploads folder.

* The original file in backend/data is never changed.
* Each upload is saved as its own CSV in backend/data/uploads. Delete a file there and it is no longer used.
  A CSV dropped into that folder by hand shows up too.
* Which datasets the app analyses is a setting (the Add data page). The chosen files are combined: if a ticket ID is in
  more than one file, the newest file wins (that is how an open ticket gets its close date)."""
import io
import json
import re
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import pandas as pd

from app import config
from app.repository.ticket_repository import TicketRepository
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
ORIGINAL_ID = "original"


class UploadError(ValueError):
    """The file cannot be read at all (empty, wrong encoding, too large)."""


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


@dataclass
class Dataset:
    id: str                       # "original", or the file name inside the uploads folder
    name: str
    kind: str                     # "original" or "upload"
    modified: float
    frame: Optional[pd.DataFrame] = None     # the cleaned tickets, None when the file has problems
    tickets: int = 0
    first: str = ""
    last: str = ""
    problems: List[str] = field(default_factory=list)
    selected: bool = False

    @property
    def ok(self) -> bool:
        return self.frame is not None

    def public(self) -> dict:
        return {"id": self.id, "name": self.name, "kind": self.kind, "tickets": self.tickets, "first": self.first, "last": self.last,
                "status": "ok" if self.ok else "problem", "problems": self.problems[:3], "selected": self.selected,
                "modified": pd.Timestamp(self.modified, unit="s").isoformat(timespec="minutes")}


def _blank_to_missing(clean: pd.DataFrame) -> pd.DataFrame:
    return clean.mask(clean.eq(""))


def window(repo: TicketRepository) -> dict:
    months = {}
    for t in repo.all():
        key = t.created_at.strftime("%Y-%m")
        months[key] = months.get(key, 0) + 1
    return {"tickets": len(repo.all()), "open": len(repo.open_queue()), "first_date": repo.first_day.date().isoformat(),
            "last_created": max(t.created_at for t in repo.all()).date().isoformat(), "as_of": repo.as_of.isoformat(timespec="minutes"),
            "as_of_is_manual": repo.as_of_is_manual, "months": [{"month": k, "tickets": v} for k, v in sorted(months.items())]}


class DataCatalog:
    """Finds the datasets on disk, remembers which ones are switched on, and hands the chosen ones to the app."""

    def __init__(self, base_path: Path = config.DATA_PATH, uploads_dir: Path = config.UPLOADS_DIR, state_dir: Path = config.STATE_DIR):
        self.base_path, self.uploads_dir, self.state_dir = Path(base_path), Path(uploads_dir), Path(state_dir)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.settings_path = self.state_dir / "data_settings.json"
        self._cache: dict = {}
        self._lock = threading.RLock()
        legacy = self.state_dir / "uploaded_tickets.csv"          # older versions kept all uploads in one hidden file
        if legacy.exists() and not (self.uploads_dir / legacy.name).exists():
            legacy.replace(self.uploads_dir / legacy.name)

    # ---- what is on disk ---------------------------------------------------------------------------------
    def _files(self) -> List[Path]:
        uploads = sorted((p for p in self.uploads_dir.glob("*.csv") if p.is_file()), key=lambda p: (p.stat().st_mtime_ns, p.name))
        return ([self.base_path] if self.base_path.exists() else []) + uploads

    def signature(self) -> tuple:
        """Changes whenever a dataset file or the settings change, so the app knows to reload."""
        stat = lambda p: (p.name, p.stat().st_mtime_ns, p.stat().st_size) if p.exists() else (p.name, 0, 0)
        return tuple(stat(p) for p in self._files()) + (stat(self.settings_path),)

    def settings(self) -> dict:
        try:
            data = json.loads(self.settings_path.read_text())
        except (OSError, ValueError):
            data = {}
        return {"excluded": list(data.get("excluded", [])), "as_of": data.get("as_of") or None}

    def _save_settings(self, excluded: List[str], as_of: Optional[str]) -> None:
        with self._lock:
            self.settings_path.write_text(json.dumps({"excluded": sorted(excluded), "as_of": as_of}))

    def _load(self, path: Path) -> Dataset:
        st = path.stat()
        key = (str(path), st.st_mtime_ns, st.st_size)
        if key not in self._cache:
            original = path == self.base_path
            ds = Dataset(ORIGINAL_ID if original else path.name, "Original data" if original else path.name,
                         "original" if original else "upload", st.st_mtime)
            try:
                if original:
                    frame = pd.read_csv(path, dtype=str)                       # the file from the case study is trusted
                else:
                    res = check_rows(read_upload(path.read_bytes()), set(config.REQUIRED_INFO))
                    if res["errors"]:
                        first = res["errors"][0]
                        ds.problems = [f"{'Row ' + str(first['row']) + ', ' if first['row'] else ''}{first['column'] or 'file'}: {first['message']}"]
                        if len(res["errors"]) > 1:
                            ds.problems.append(f"{len(res['errors']) - 1} more problem(s)")
                    frame = None if res["errors"] else _blank_to_missing(res["clean"])
            except UploadError as e:
                ds.problems, frame = [str(e)], None
            if frame is not None:
                created = pd.to_datetime(frame["created_at"])
                ds.frame, ds.tickets = frame, len(frame)
                ds.first, ds.last = created.min().date().isoformat(), created.max().date().isoformat()
            self._cache[key] = ds
        return self._cache[key]

    def datasets(self) -> List[Dataset]:
        excluded = set(self.settings()["excluded"])
        out = []
        for p in self._files():
            ds = self._load(p)
            ds.selected = ds.ok and ds.id not in excluded
            out.append(ds)
        return out

    def selected_frames(self) -> List[pd.DataFrame]:
        return [d.frame for d in self.datasets() if d.selected]

    # ---- changing what is used ---------------------------------------------------------------------------
    def apply_selection(self, selected: Optional[List[str]], as_of: Optional[str], as_of_given: bool) -> None:
        with self._lock:
            current, ds = self.settings(), self.datasets()
            chosen = {d.id for d in ds if d.selected} if selected is None else set(selected)
            unknown = chosen - {d.id for d in ds}
            if unknown:
                raise UploadError("Unknown dataset: " + ", ".join(sorted(unknown)))
            usable = {d.id for d in ds if d.ok} & chosen
            if not usable:
                raise UploadError("Choose at least one dataset that has no problems.")
            if as_of_given and as_of:
                try:
                    pd.Timestamp(as_of)
                except ValueError:
                    raise UploadError("That is not a valid date.")
            self._save_settings([d.id for d in ds if d.ok and d.id not in usable], (as_of or None) if as_of_given else current["as_of"])

    def save_upload(self, name: str, clean: pd.DataFrame) -> str:
        stem = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name or "tickets").stem).strip("._") or "tickets"
        with self._lock:
            path, n = self.uploads_dir / f"{stem[:60]}.csv", 2
            while path.exists():
                path, n = self.uploads_dir / f"{stem[:60]}-{n}.csv", n + 1
            clean.to_csv(path, index=False)
        return path.name

    def delete_upload(self, dataset_id: str) -> None:
        if dataset_id == ORIGINAL_ID:
            raise UploadError("The original data is part of the project. Untick it to stop using it.")
        path = self.uploads_dir / dataset_id
        if Path(dataset_id).name != dataset_id or not path.is_file():
            raise KeyError(dataset_id)
        with self._lock:
            path.unlink()

    # ---- reports -----------------------------------------------------------------------------------------
    def status(self, repo: Optional[TicketRepository]) -> dict:
        ds = self.datasets()
        return {"folder": "data/uploads", "columns": COLUMNS, "datasets": [d.public() for d in ds],
                "selected_count": sum(d.selected for d in ds), "as_of_setting": self.settings()["as_of"],
                "current": window(repo) if repo is not None else None}

    def inspect(self, raw: bytes, repo: Optional[TicketRepository]) -> dict:
        """Check a file and say what adding it would do. Nothing is saved."""
        df = read_upload(raw)
        res = check_rows(df, set(config.REQUIRED_INFO))
        report = {"rows": int(len(df)), "errors": res["errors"][:MAX_SHOWN], "error_count": len(res["errors"]),
                  "warnings": res["warnings"][:MAX_SHOWN], "warning_count": len(res["warnings"]), "ok": not res["errors"]}
        if res["errors"]:
            return {**report, "clean": None}
        clean = res["clean"]
        existing = {t.ticket_id for t in repo.all()} if repo is not None else set()
        replaced = int(clean.ticket_id.isin(existing).sum())
        preview = TicketRepository().load_frames(self.selected_frames() + [_blank_to_missing(clean)], self.settings()["as_of"])
        before = window(repo) if repo is not None else None
        report.update(new_tickets=int(len(clean) - replaced), replaced_tickets=replaced,
                      file_from=str(clean.created_at.min())[:10], file_to=str(clean.created_at.max())[:10],
                      before={"tickets": before["tickets"], "as_of": before["as_of"], "open": before["open"]} if before else None,
                      after=window(preview))
        if before:
            loaded_to = max(t.created_at for t in repo.all())
            gap = (pd.Timestamp(clean.created_at.min()) - pd.Timestamp(loaded_to)).days
            if gap > 7:
                report["warnings"].append({"row": None, "column": "created_at", "message":
                    f"There is a gap: the loaded data ends on {loaded_to:%d %b} and this file starts on {pd.Timestamp(clean.created_at.min()):%d %b}. "
                    "The weekly charts will show empty weeks in between. Upload the missing days too if you have them."})
                report["warning_count"] += 1
        was = {m["month"]: m["tickets"] for m in before["months"]} if before else {}
        report["months"] = [{**m, "was": was.get(m["month"], 0)} for m in report["after"]["months"]]
        return {**report, "clean": clean}
