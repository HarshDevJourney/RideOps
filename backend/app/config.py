"""All paths, thresholds and domain assumptions live here so they can be changed and defended in one place."""
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "rideops_support_tickets.csv"
UPLOADS_DIR = BASE_DIR / "data" / "uploads"   # one CSV per upload. Delete a file here and it is no longer used
STATE_DIR = BASE_DIR / "data" / "state"    # agent feedback and which datasets are switched on (a Docker volume)
FEEDBACK_PATH = STATE_DIR / "feedback.json"

# The "as of" date now comes from the data itself (the latest timestamp in the tickets, or the date typed on the
# Data page). This value is only the fallback for a ticket that is built by hand, for example in unit tests.
AS_OF = datetime(2026, 9, 30, 23, 59)
BACKTEST_FIRST_SPLIT_DAYS = 13   # earliest backtest date = first ticket date + this many days (enough to learn from)
BACKTEST_LAST_SPLIT_DAYS = 5     # latest backtest date = "as of" date minus this many days (enough to replay)
MAX_UPLOAD_BYTES = 8 * 1024 * 1024

MIN_REPEATS = 30          # a description repeated this often (on full data) counts as a known issue
BOUNCE_AT = 2             # engineering handoffs at which a ticket is "bouncing"
FLAG_AVOIDABLE_RATE = 0.70  # similar escalations this often NOT fixed -> advise checking first
FLAG_MIN_EVIDENCE = 5     # ...but only with at least this many past escalations to learn from
GATE_INFO_GAP_RATE = 0.45   # categories where >=45% of escalations came back for info/config
GATE_MIN_EVIDENCE = 10
REOPEN_RISK_FLAG = 0.20   # predicted reopen chance at which we show REOPEN_RISK
# ASSUMPTION: suggested targets for the weekly success measure. Agree the real ones with Ritika before a pilot.
SUCCESS_TARGETS = {"avoidable_rate": 0.40, "bounce_rate": 0.10, "net_backlog": 0}

CLIENT_ALERT_SHARE = 0.10   # one client causing >=10% of escalations raises an alert
CLIENT_WATCH_RATE = 0.60    # ...or >=60% of its tickets escalated (min 10 tickets)

# ASSUMPTION: the CSV does not say which details engineering was missing, so these checklists are
# written from domain knowledge. The data only tells us HOW OFTEN each category comes back for info.
REQUIRED_INFO = {
    "Roster / booking not syncing": ["Roster or shift ID", "Example employee IDs affected", "Expected vs actual booking", "When the booking or cutoff was changed"],
    "Live tracking / GPS incorrect": ["Trip ID and cab number", "Time the issue started", "Driver app version", "Screenshot of the map"],
    "Report export failing": ["Report name and date range", "File format (Excel or PDF)", "Time of the failed attempt", "Screenshot of the error"],
    "Cab delay / no-show complaint": ["Trip ID", "Scheduled vs actual pickup time", "Driver and cab number"],
    "How-to / feature request": ["What the admin is trying to achieve"],
    "Login / access issue": ["User email", "Error message shown", "Client SSO or password login"],
    "OTP / boarding issue": ["Trip ID", "Employee ID", "OTP shown vs entered", "Driver app version"],
    "Billing / invoice discrepancy": ["Invoice number", "Trip IDs in dispute", "Client's own trip count"],
    "Employee address / geocode change": ["Employee ID", "Old and new address", "Date the change was requested"],
    "Driver / vehicle compliance docs": ["Driver or vehicle ID", "Document type and expiry date"],
}
CLOSING_CHECKLIST = {
    "default": ["Confirm with the client that the issue is gone", "Note the cause and fix in the ticket"],
    "Roster / booking not syncing": ["Ask the client to re-check tomorrow's roster", "Confirm the booking cutoff setting matches what they expect"],
    "Live tracking / GPS incorrect": ["Ask for one live trip where tracking works", "Confirm the driver app is on the latest version"],
    "Report export failing": ["Ask the client to download the report again", "Check both Excel and PDF if they use both"],
}
