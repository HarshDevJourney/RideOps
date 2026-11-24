import pandas as pd

from app import config
from app.repository.ticket_repository import TicketRepository
from app.tags import FIXED


def _f(x, nd=2):
    return None if pd.isna(x) else round(float(x), nd)


class MetricsService:
    """Numbers for the support lead. Every figure is computed from the ticket table."""

    def __init__(self, repo: TicketRepository):
        self.repo = repo

    @property
    def df(self):
        return self.repo.df

    def summary(self) -> dict:
        d = self.df
        esc = d[d.escalated]
        return {
            "tickets": len(d), "open": int(d.status.ne("Closed").sum()), "escalated": len(esc),
            "escalation_rate": _f(len(esc) / len(d), 3), "fixed": int(esc.eng_outcome.eq(FIXED).sum()),
            "avoidable": int(d.avoidable.sum()), "avoidable_rate": _f(d.avoidable.sum() / len(esc), 3),
            "median_close_hours": _f(d.ttr_hours.median(), 1), "reopen_rate": _f((d.reopen_count >= 1).mean(), 3),
            "bounce_rate": _f((d.eng_handoffs >= config.BOUNCE_AT).mean(), 3), "csat": _f(d.csat_score.mean()),
            "outcomes": {k: int(v) for k, v in esc.eng_outcome.value_counts().items()},
            "monthly": self._monthly(),
        }

    def _monthly(self) -> list:
        d = self.df.assign(month=self.df.created_at.dt.strftime("%b"))
        rows = []
        for m in ["Jul", "Aug", "Sep"]:
            g = d[d.month == m]
            rows.append({"month": m, "tickets": len(g), "escalated": int(g.escalated.sum()), "avoidable": int(g.avoidable.sum())})
        return rows

    def category_trend(self) -> list:
        """Which categories grew from July to September?"""
        d = self.df.assign(month=self.df.created_at.dt.strftime("%b"))
        t = d.pivot_table(index="category", columns="month", values="ticket_id", aggfunc="count", fill_value=0)
        rows = [{"category": c, "jul": int(t.loc[c, "Jul"]), "aug": int(t.loc[c, "Aug"]), "sep": int(t.loc[c, "Sep"]),
                 "change": int(t.loc[c, "Sep"] - t.loc[c, "Jul"])} for c in t.index]
        return sorted(rows, key=lambda r: -r["change"])

    def success(self) -> dict:
        """The weekly success measure. Weeks are cohorts: tickets grouped by the week they were created."""
        d = self.df.copy()
        d["week"] = d.created_at.dt.normalize() - pd.to_timedelta(d.created_at.dt.weekday, unit="D")
        as_of, first_day = pd.Timestamp(config.AS_OF), d.created_at.min().normalize()

        def kpis(g):
            esc = g[g.escalated]
            return {"tickets": len(g), "escalated": len(esc), "escalation_rate": _f(g.escalated.mean(), 3),
                    "avoidable_rate": _f(esc.avoidable.mean(), 3) if len(esc) else None,
                    "bounce_rate": _f((g.eng_handoffs >= config.BOUNCE_AT).mean(), 3),
                    "reopen_rate": _f((g.reopen_count >= 1).mean(), 3),
                    "median_hours": _f(g.ttr_hours.median(), 1), "csat": _f(g.csat_score.mean())}

        backlog = {r["week"]: r for r in self.weekly_backlog()}
        rows = []
        for w, g in d.groupby("week"):
            label = w.strftime("%d %b")
            rows.append({"week": label, "partial": bool(w < first_day or w + pd.Timedelta(days=7) > as_of),
                         **kpis(g), "net": backlog[label]["net"], "open_at_end": backlog[label]["open_at_end"]})
        full = [r for r in rows if not r["partial"]]
        base_w, last_w = [r["week"] for r in full[:4]], [r["week"] for r in full[-4:]]
        pick = lambda ws: d[d.week.dt.strftime("%d %b").isin(ws)]
        base, last = kpis(pick(base_w)), kpis(pick(last_w))
        base["net_backlog"] = round(sum(r["net"] for r in full[:4]) / 4, 1)
        last["net_backlog"] = round(sum(r["net"] for r in full[-4:]) / 4, 1)
        t = config.SUCCESS_TARGETS
        measures = [
            {"key": "avoidable_rate", "label": "Avoidable escalation rate", "role": "Primary", "better": "lower", "fmt": "pct",
             "how": "Escalations that engineering did not fix, divided by all escalations"},
            {"key": "bounce_rate", "label": "Bounce rate", "role": "Driver", "better": "lower", "fmt": "pct",
             "how": "Tickets with 2 or more handoffs between L1 and engineering"},
            {"key": "net_backlog", "label": "Net backlog per week", "role": "Outcome", "better": "lower", "fmt": "num",
             "how": "Tickets created minus tickets closed, average per week. At or below 0 means the backlog stops growing"},
            {"key": "reopen_rate", "label": "Reopen rate", "role": "Guardrail", "better": "lower", "fmt": "pct",
             "how": "Tickets reopened at least once. Must not rise while the primary measure falls"},
            {"key": "median_hours", "label": "Median hours to close", "role": "Guardrail", "better": "lower", "fmt": "hours",
             "how": "Created to final close, closed tickets only"},
            {"key": "csat", "label": "CSAT", "role": "Guardrail", "better": "higher", "fmt": "num",
             "how": "Average client satisfaction score"},
        ]
        for m in measures:
            m["baseline"], m["latest"], m["target"] = base[m["key"]], last[m["key"]], t.get(m["key"])
        return {"measures": measures, "weekly": rows, "baseline_weeks": base_w, "latest_weeks": last_w,
                "caveat": "Recent weeks can look better than they are: open tickets are not yet counted as reopened or closed."}

    def weekly_backlog(self) -> list:
        d, as_of = self.df, pd.Timestamp(config.AS_OF)
        first = (d.created_at.min().normalize() - pd.Timedelta(days=d.created_at.min().weekday()))
        rows = []
        for w in pd.date_range(first, as_of, freq="7D"):
            end = min(w + pd.Timedelta(days=7), as_of)
            created = int(((d.created_at >= w) & (d.created_at < w + pd.Timedelta(days=7))).sum())
            closed = int(((d.final_closed_at >= w) & (d.final_closed_at < w + pd.Timedelta(days=7))).sum())
            open_end = int(((d.created_at <= end) & (d.final_closed_at.isna() | (d.final_closed_at > end))).sum())
            rows.append({"week": w.strftime("%d %b"), "created": created, "closed": closed,
                         "net": created - closed, "open_at_end": open_end})
        return rows

    def escalation_yield(self) -> dict:
        esc = self.df[self.df.escalated]
        s = self.summary()
        return {"escalated": s["escalated"], "fixed": s["fixed"], "yield": _f(s["fixed"] / s["escalated"], 3),
                "avoidable": s["avoidable"], "outcomes": s["outcomes"],
                "by_category": self._by_category(esc)}

    @staticmethod
    def _by_category(esc) -> list:
        g = esc.groupby("category").agg(escalated=("ticket_id", "size"), avoidable=("avoidable", "sum")).reset_index()
        g["avoidable_rate"] = (g.avoidable / g.escalated).round(2)
        return g.sort_values("escalated", ascending=False).to_dict("records")

    def categories(self) -> list:
        d = self.df
        g = d.groupby("category").agg(tickets=("ticket_id", "size"), escalated=("escalated", "sum"),
                                      avoidable=("avoidable", "sum"), median_hours=("ttr_hours", "median")).reset_index()
        g["escalation_rate"] = (g.escalated / g.tickets).round(2)
        g["avoidable_rate"] = (g.avoidable / g.escalated.where(g.escalated > 0)).round(2).fillna(0)
        g["median_hours"] = g.median_hours.round(1)
        return g.sort_values("tickets", ascending=False).astype({"escalated": int, "avoidable": int}).to_dict("records")

    def bounce_rate(self) -> dict:
        d = self.df
        rows = []
        for h, g in d.groupby("eng_handoffs"):
            rows.append({"handoffs": int(h), "tickets": len(g), "median_hours": _f(g.ttr_hours.median(), 1),
                         "csat": _f(g.csat_score.mean()), "reopen_rate": _f((g.reopen_count >= 1).mean(), 3)})
        return {"bounce_rate": self.summary()["bounce_rate"], "by_handoffs": rows}

    def agent_scorecard(self) -> list:
        d = self.df
        team_reopen, team_esc = (d.reopen_count >= 1).mean(), d.escalated.mean()
        rows = []
        for agent, g in d.groupby("assigned_agent"):
            esc = g[g.escalated]
            reopen, esc_rate = (g.reopen_count >= 1).mean(), g.escalated.mean()
            flags = []
            if reopen >= 2 * team_reopen:
                flags.append("Reopens often")
            if esc_rate >= 1.5 * team_esc:
                flags.append("Escalates often")
            if g.ttr_hours.median() < d.ttr_hours.median() * 0.7 and reopen >= 1.5 * team_reopen:
                flags.append("Fast but reopened")
            if len(esc) >= 20 and esc.avoidable.mean() >= 0.65:
                flags.append("Many avoidable escalations")
            rows.append({"agent": agent, "tickets": len(g), "median_hours": _f(g.ttr_hours.median(), 1),
                         "escalation_rate": _f(esc_rate, 3), "reopen_rate": _f(reopen, 3), "csat": _f(g.csat_score.mean()),
                         "escalated": len(esc), "avoidable_rate": _f(esc.avoidable.mean(), 3) if len(esc) else None, "flags": flags})
        return sorted(rows, key=lambda r: -r["tickets"])

    def top_clients(self, n: int = 3) -> dict:
        d = self.df
        total_esc = int(d.escalated.sum())
        g = d.groupby(["client_id", "client_name"]).agg(tickets=("ticket_id", "size"), escalated=("escalated", "sum")).reset_index()
        g["share"] = (g.escalated / total_esc).round(3)
        g["rate"] = (g.escalated / g.tickets).round(2)
        g["alert"] = g.share >= config.CLIENT_ALERT_SHARE
        g["watch"] = (g.rate >= config.CLIENT_WATCH_RATE) & (g.tickets >= 10)
        top = g.sort_values(["escalated", "rate"], ascending=False).head(n).astype({"escalated": int})
        top3_share = round(float(top.escalated.sum()) / total_esc, 3)
        watch = g[g.watch & ~g.client_id.isin(top.client_id)].sort_values("rate", ascending=False).head(3).astype({"escalated": int})
        return {"top": top.to_dict("records"), "top_share": top3_share, "clients": int(g.shape[0]),
                "alert": bool(top.alert.any()), "alert_share": config.CLIENT_ALERT_SHARE,
                "watch": watch.to_dict("records")}
