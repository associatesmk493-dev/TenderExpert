import pandas as pd
import sys

# ── Mapping dictionaries ──────────────────────────────────────────────────────

FUNNEL_STAGE_MAP = {
    "lead capture":                  "lead",
    "lead qualification":            "qualified lead",
    "meeting / proposal / quotation":"meetings/ need analysis",
    "need analysis":                 "meetings/ need analysis",
    "negotiation":                   "negotiation",
    "won":                           "order won",
    "lost":                          "lost/closed -lost",
    "existing customer":             None,   # not in software → null
    "rnr":                           None,
}

REGION_MAP = {
    "north":   "north india",
    "south":   "south india",
    "west":    "west india",
    "central": "central india",
    "east":    "east india",
}

INDUSTRY_MAP = {
    "horeca":                 "HoReca",
    "hotel":                  "HoReca",
    "food service":           "HoReca",
    "restaurant":             "HoReca",
    "concession supply":      "consession supply",
    "dealers":                "dealers",
    "dealer":                 "dealers",
    "cinema":                 "cinemas",
    "cinemas":                "cinemas",
    # everything else → null
    "event planner":          None,
    "gifts":                  None,
    "amusement park":         None,
    "builder general contractor": None,
    "surveyor":               None,
    "health & wellness services": None,
    "others -":               None,
    "others":                 None,
    "vaastu consultant":      None,
    "architect":              None,
    "interior architecture":  None,
    "landscape services":     None,
    "civil structural engineer": None,
}

BUSINESS_TYPE_MAP = {
    "retail":                "retail",
    "consumable supplies":   "consumer supply",
    "projects":              "projects",
    "spares":                "spares",
    "cinema":                None,   # cinema is industry, not business type
    "dealer":                None,
    "others":                None,
}

LEAD_TYPE_MAP = {
    "nbd incomming": "NBD Incomming",
    "nbd outgoing":  "NBD Outgoing",
    "nbd crr":       "NBD CRR",
}

# Lead source has no equivalent in software → will be set to null automatically
# by the column-drop logic below (keep it if software has the column, else drop).

# ── Column name aliases (lowercase source col → canonical name) ───────────────
COLUMN_ALIASES = {
    "funnel stage":    "funnel_stage",
    "funnel_stage":    "funnel_stage",
    "stage":           "funnel_stage",
    "region":          "region",
    "industry":        "industry",
    "business type":   "business_type",
    "business_type":   "business_type",
    "lead type":       "lead_type",
    "lead_type":       "lead_type",
    "lead source":     "lead_source",
    "lead_source":     "lead_source",
}

# ── Helper ────────────────────────────────────────────────────────────────────

def apply_map(value, mapping):
    if pd.isna(value) or str(value).strip() == "":
        return None
    key = str(value).strip().lower()
    if key in mapping:
        return mapping[key]   # None means empty/null
    return None               # unknown value → null so import doesn't fail


def transform(input_path: str, output_path: str):
    df = pd.read_csv(input_path, dtype=str)

    # Normalise column names
    df.columns = [COLUMN_ALIASES.get(c.strip().lower(), c.strip().lower()) for c in df.columns]

    if "funnel_stage" in df.columns:
        df["funnel_stage"] = df["funnel_stage"].apply(lambda v: apply_map(v, FUNNEL_STAGE_MAP))

    if "region" in df.columns:
        df["region"] = df["region"].apply(lambda v: apply_map(v, REGION_MAP))

    if "industry" in df.columns:
        df["industry"] = df["industry"].apply(lambda v: apply_map(v, INDUSTRY_MAP))

    if "business_type" in df.columns:
        df["business_type"] = df["business_type"].apply(lambda v: apply_map(v, BUSINESS_TYPE_MAP))

    if "lead_type" in df.columns:
        df["lead_type"] = df["lead_type"].apply(lambda v: apply_map(v, LEAD_TYPE_MAP))

    if "lead_source" in df.columns:
        # Lead source has no mapping in the software; set all to empty
        df["lead_source"] = None

    # Replace Python None with empty string so CSV has blank cells (not "None")
    df = df.where(pd.notna(df), other="")
    df = df.replace("None", "")

    df.to_csv(output_path, index=False)
    print(f"Done! Mapped file saved to: {output_path}")
    print(f"Rows processed: {len(df)}")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python csv_mapper.py <input.csv> [output.csv]")
        sys.exit(1)

    input_file  = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace(".csv", "_mapped.csv")
    transform(input_file, output_file)
