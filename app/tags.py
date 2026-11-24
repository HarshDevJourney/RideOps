"""Tag names and engineering outcomes in one place. kind: fact = read from the CSV, prediction = our rule."""
INSUFFICIENT = "Insufficient info - returned to L1"
CONFIG = "Config issue - returned to L1"
DUPLICATE_O = "Duplicate of known issue"
HOWTO_O = "Not a bug - how-to"
NOTREPRO_O = "Not reproducible"
FIXED = "Fixed"

LACK_OF_INFO, CONFIG_CHECK, DUPLICATE, HOW_TO, NOT_REPRODUCIBLE = "LACK_OF_INFO", "CONFIG_CHECK", "DUPLICATE", "HOW_TO", "NOT_REPRODUCIBLE"
FIX_READY, BOUNCING, REOPENED, REOPEN_RISK, P1 = "FIX_READY", "BOUNCING", "REOPENED", "REOPEN_RISK", "P1"
SIMILAR_TO_HISTORY, COLLECT_INFO_FIRST = "SIMILAR_TO_HISTORY", "COLLECT_INFO_FIRST"

TAG_META = {
    LACK_OF_INFO: {"label": "Lack of info", "kind": "fact", "tone": "amber", "help": "Engineering sent it back for missing details"},
    CONFIG_CHECK: {"label": "Config check", "kind": "fact", "tone": "amber", "help": "Engineering found a client configuration issue"},
    DUPLICATE: {"label": "Duplicate", "kind": "fact", "tone": "blue", "help": "Engineering says it duplicates a known issue"},
    HOW_TO: {"label": "How-to", "kind": "fact", "tone": "gray", "help": "Not a bug, the client needs guidance"},
    NOT_REPRODUCIBLE: {"label": "Not reproducible", "kind": "fact", "tone": "gray", "help": "Engineering could not reproduce it"},
    FIX_READY: {"label": "Fix ready", "kind": "fact", "tone": "green", "help": "Engineering fixed it, confirm and close"},
    BOUNCING: {"label": "Bouncing", "kind": "fact", "tone": "red", "help": "Two or more handoffs between L1 and engineering"},
    REOPENED: {"label": "Reopened", "kind": "fact", "tone": "red", "help": "The client reopened this ticket before"},
    P1: {"label": "P1", "kind": "fact", "tone": "red", "help": "Critical, never blocked by any check"},
    REOPEN_RISK: {"label": "Reopen risk", "kind": "prediction", "tone": "amber", "help": "Similar tickets are often reopened"},
    SIMILAR_TO_HISTORY: {"label": "Similar to history", "kind": "prediction", "tone": "blue", "help": "Matches a repeated issue in past tickets"},
    COLLECT_INFO_FIRST: {"label": "Collect info first", "kind": "prediction", "tone": "amber", "help": "This category often comes back for missing info"},
}

# Tags that mean engineering has already answered and the next step belongs to L1.
L1_ACTION_TAGS = {LACK_OF_INFO, CONFIG_CHECK, DUPLICATE, HOW_TO, NOT_REPRODUCIBLE, FIX_READY}
