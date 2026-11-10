#!/usr/bin/env python3
"""Generate the fictional 'Meridian Components' group debt book used by DEMO.

Meridian Components is the fictional manufacturer of the AFP workshop's FP&A case.
This file mirrors the shape of the workshop's decision-ready finance table
(debt_clean.csv: month-end positions by entity, bank and instrument, in k EUR)
with friendlier column names, but every entity, bank, position and number is made up.
Deterministic (fixed seed), so the demo looks the same on every build.

One row = one facility's position at one month end (a stock, not a flow): sum it
within a month, never across months. Fiscal years run April to March.

Writes app/samples/meridian-debt-book.csv and app/samples/demo-data.js.
"""
import csv
import io
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "samples"
NAME = "meridian-debt-book.csv"
random.seed(2026)

FIRST = date(2023, 4, 30)          # first month end: start of FY2023-24
MONTHS = 36                         # to March 2026 (end of FY2025-26)
REFI = 18                           # October 2024: the group refinancing month

# entity -> (region, country, local currency, division, size weight)
ENTITIES = {
    "Meridian Group Treasury":  ("Europe", "Netherlands", "EUR", "Group Treasury", 0.0),
    "Meridian France":          ("Europe", "France", "EUR", "Precision Parts", 1.6),
    "Meridian Germany":         ("Europe", "Germany", "EUR", "Precision Parts", 1.4),
    "Meridian Iberia":          ("Europe", "Spain", "EUR", "Aftermarket", 0.7),
    "Meridian Polska":          ("Europe", "Poland", "PLN", "Industrial Systems", 0.6),
    "Meridian UK":              ("Europe", "United Kingdom", "GBP", "Aftermarket", 0.8),
    "Meridian Schweiz":         ("Europe", "Switzerland", "CHF", "Electronics", 0.5),
    "Meridian Inc.":            ("Americas", "United States", "USD", "Industrial Systems", 1.5),
    "Meridian de México":       ("Americas", "Mexico", "MXN", "Precision Parts", 0.7),
    "Meridian do Brasil":       ("Americas", "Brazil", "BRL", "Aftermarket", 0.5),
    "Meridian Asia Pacific":    ("Asia-Pacific", "Hong Kong", "HKD", "Electronics", 0.9),
    "Meridian Singapore":       ("Asia-Pacific", "Singapore", "SGD", "Electronics", 0.8),
    "Meridian Malaysia":        ("Asia-Pacific", "Malaysia", "MYR", "Electronics", 0.7),
    "Meridian China":           ("Asia-Pacific", "China", "CNY", "Precision Parts", 1.1),
    "Meridian Japan":           ("Asia-Pacific", "Japan", "JPY", "Industrial Systems", 0.4),
}
BANKS = {
    "Europe": ["Northbridge Bank", "Banque Lumière", "Rheinland Kreditbank", "Atlas Trust"],
    "Americas": ["Northbridge Bank", "Crown & Cedar", "Atlas Trust"],
    "Asia-Pacific": ["Pacific Harbour Bank", "Northbridge Bank", "Lotus Commercial"],
}
IHB = "Meridian In-House Bank"      # intercompany counterparty

# instrument -> (category, tenor bucket, typical size k EUR, spread over the policy rate)
INSTRUMENTS = {
    "Cash account":          ("Cash", "Overnight", 4200, -2.0),
    "Overdraft":             ("Borrowing", "Overnight", 2600, 2.4),
    "Short-term borrowing":  ("Borrowing", "Up to 1 year", 6500, 1.3),
    "Medium-term borrowing": ("Borrowing", "1 to 5 years", 14000, 1.6),
    "Long-term borrowing":   ("Borrowing", "Over 5 years", 30000, 1.9),
    "Short-term lending":    ("Lending", "Up to 1 year", 5200, 0.6),
    "Medium-term lending":   ("Lending", "1 to 5 years", 9000, 0.9),
    "Guarantee":             ("Off-balance sheet", "1 to 5 years", 3000, 0.3),
}
CHECKS = [("Missing rate", 0.35), ("Unmapped bank", 0.25), ("Stale FX rate", 0.25), ("Maturity before start", 0.15)]


def month_end(i):
    y, m = FIRST.year + (FIRST.month - 1 + i) // 12, (FIRST.month - 1 + i) % 12 + 1
    return date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)


def fiscal_year(d):
    y = d.year if d.month >= 4 else d.year - 1
    return f"FY{y}-{str(y + 1)[2:]}"


def policy_rate(i):
    """A made-up policy-rate path: high in 2023, easing through 2024-25."""
    return 4.0 - 1.9 / (1 + math.exp(-(i - 16) / 3.5))


def pick(weighted):
    r = random.random() * sum(w for _, w in weighted)
    for item, w in weighted:
        r -= w
        if r <= 0:
            return item
    return weighted[-1][0]


def facilities():
    out = []
    for ent, (region, country, ccy, division, size) in ENTITIES.items():
        if ent == "Meridian Group Treasury":
            # The refinancing: a 7-year term loan drawn in October 2024 that pays down
            # short-term bank lines across Europe (see `repaid` below).
            out.append(dict(entity=ent, inst="Long-term borrowing", bank="Atlas Trust", ccy="EUR",
                            size=120000, start=REFI, end=MONTHS, ic=False, trend=0.0, seas=0.0, bullet=True))
            out.append(dict(entity=ent, inst="Medium-term borrowing", bank="Northbridge Bank", ccy="EUR",
                            size=60000, start=0, end=MONTHS, ic=False, trend=-0.004, seas=0.0))
            out.append(dict(entity=ent, inst="Cash account", bank="Northbridge Bank", ccy="EUR",
                            size=30000, start=0, end=MONTHS, ic=False, trend=0.008, seas=0.12))
            for _ in range(5):
                out.append(dict(entity=ent, inst=random.choice(["Short-term lending", "Medium-term lending"]),
                                bank=IHB, ccy="EUR", size=random.uniform(6000, 18000), start=0, end=MONTHS,
                                ic=True, trend=random.uniform(-0.008, 0.008), seas=0.05))
            continue
        plan = [("Cash account", 2), ("Overdraft", 1), ("Short-term borrowing", 2), ("Medium-term borrowing", 1),
                ("Long-term borrowing", 1 if size > 1.0 else 0), ("Guarantee", 1)]
        for inst, n in plan:
            for _ in range(n):
                bank = random.choice(BANKS[region])
                # Intercompany funding from the in-house bank replaces part of the external lines.
                ic = inst in ("Short-term borrowing", "Medium-term borrowing") and random.random() < 0.35
                if ic:
                    bank = IHB
                start = 0 if random.random() < 0.75 else random.randrange(1, 24)
                end = MONTHS if random.random() < 0.8 else random.randrange(start + 8, MONTHS + 1)
                apac_cash = region == "Asia-Pacific" and inst == "Cash account"
                out.append(dict(
                    entity=ent, inst=inst, bank=bank, ic=ic, start=start, end=end,
                    ccy=ccy if random.random() < 0.75 else random.choice(["EUR", "USD"]),
                    size=INSTRUMENTS[inst][2] * size * random.uniform(0.5, 1.6),
                    trend=random.gauss(0.012 if apac_cash else 0.0, 0.004),
                    seas=0.25 if inst == "Overdraft" else 0.08,
                    repaid=region == "Europe" and inst in ("Short-term borrowing", "Overdraft") and not ic))
    return out


def main():
    rows = []
    for f in facilities():
        cat, tenor, _, spread = INSTRUMENTS[f["inst"]]
        region, country, _, division, _ = ENTITIES[f["entity"]]
        fixed = f["inst"] in ("Long-term borrowing", "Medium-term borrowing") and random.random() < 0.6
        fixed_rate = policy_rate(f["start"]) + spread + random.gauss(0, 0.25)
        level = f["size"]
        for i in range(f["start"], f["end"]):
            d = month_end(i)
            # working-capital season: overdrafts peak in Oct-Dec
            season = math.sin((d.month - 7) / 12 * 2 * math.pi)
            level *= 1 + f["trend"] + random.gauss(0, 0.02)
            amount = f["size"] if f.get("bullet") else level * (1 + f["seas"] * season)
            if f.get("repaid") and i >= REFI:
                amount *= 0.35 if i < REFI + 3 else 0.15
            if amount < 1:
                continue
            budget = amount * random.uniform(0.9, 1.08)
            rate = fixed_rate if fixed else policy_rate(i) + spread + random.gauss(0, 0.2)
            rate = max(0.0, round(rate, 2))
            sign = {"Borrowing": -1, "Cash": 1, "Lending": 1}.get(cat, 0)
            check = pick(CHECKS) if random.random() < 0.04 else "Clean"
            rows.append({
                "Month End": d.isoformat(),
                "Fiscal Year": fiscal_year(d),
                "Region": region,
                "Country": country,
                "Entity": f["entity"],
                "Division": division,
                "Bank": f["bank"],
                "Instrument": f["inst"],
                "Category": cat,
                "Tenor": tenor,
                "Currency": f["ccy"],
                "Intercompany": "Yes" if f["ic"] else "No",
                "Rate Type": "Fixed" if fixed else "Floating",
                "Outstanding (k EUR)": round(amount, 1),
                "Budget (k EUR)": round(budget, 1),
                "Net Position (k EUR)": round(sign * amount, 1),
                "Rate (%)": "" if check == "Missing rate" else rate,
                "Annual Interest (k EUR)": round(amount * rate / 100, 1),
                "Data Check": check,
            })
    rows.sort(key=lambda r: (r["Month End"], r["Region"], r["Entity"], r["Instrument"]))

    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    text = buf.getvalue()

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / NAME).write_text(text, encoding="utf-8")
    (OUT / "demo-data.js").write_text(
        "/* Generated by tools/make_demo_data.py - fictional data for the DEMO button. */\n"
        "window.CROSSFOOT_DEMO_CSV = " + json.dumps(text) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(rows)} demo rows -> {OUT / NAME}")


if __name__ == "__main__":
    main()
