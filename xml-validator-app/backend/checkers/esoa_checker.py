import xml.etree.ElementTree as ET
import re
from datetime import date


REQUIRED_FIELDS = [
    "SOAID",
    "EffectiveDate",
    "ExpiryDate",
    "CoverageType",
    "PremiumAmount",
    "InsuredName",
]

VALID_ROOTS = {"ESOA", "ESOADocument"}
VALID_COVERAGE_TYPES = {"HEALTH", "LIFE", "PROPERTY", "AUTO"}


def find_line(xml_string: str, tag: str) -> int:
    lines = xml_string.splitlines()
    for i, line in enumerate(lines, start=1):
        if f"<{tag}" in line or f"<{tag}>" in line:
            return i
    return 0


def parse_date(value: str):
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def check_esoa(filename: str, content: str) -> dict:
    errors = []

    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        return {
            "filename": filename,
            "status": "fail",
            "errors": [
                {
                    "field": "XML",
                    "rule": "well_formed",
                    "message": f"XML parse error: {e}",
                    "line": getattr(e, "position", (0, 0))[0] if hasattr(e, "position") else 0,
                    "severity": "error",
                }
            ],
        }

    root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if root_tag not in VALID_ROOTS:
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": f"Root element must be <ESOA> or <ESOADocument>, got <{root_tag}>",
                "line": 1,
                "severity": "error",
            }
        )

    def get_field(tag):
        return root.find(f".//{tag}")

    field_values = {}

    for field in REQUIRED_FIELDS:
        el = get_field(field)
        if el is None or (el.text is None) or el.text.strip() == "":
            line = find_line(content, field)
            errors.append(
                {
                    "field": field,
                    "rule": "required",
                    "message": f"Required field <{field}> is missing or empty",
                    "line": line,
                    "severity": "error",
                }
            )
        else:
            value = el.text.strip()
            field_values[field] = value
            line = find_line(content, field)

            # EffectiveDate and ExpiryDate: YYYY-MM-DD
            if field in ("EffectiveDate", "ExpiryDate"):
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                    errors.append(
                        {
                            "field": field,
                            "rule": "date_format",
                            "message": f"{field} must be in YYYY-MM-DD format, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )
                else:
                    d = parse_date(value)
                    if d is None:
                        errors.append(
                            {
                                "field": field,
                                "rule": "date_valid",
                                "message": f"{field} is not a valid calendar date: '{value}'",
                                "line": line,
                                "severity": "error",
                            }
                        )

            # PremiumAmount: positive decimal
            elif field == "PremiumAmount":
                try:
                    amount = float(value)
                    if amount <= 0:
                        errors.append(
                            {
                                "field": field,
                                "rule": "positive_decimal",
                                "message": f"PremiumAmount must be a positive decimal, got '{value}'",
                                "line": line,
                                "severity": "error",
                            }
                        )
                except ValueError:
                    errors.append(
                        {
                            "field": field,
                            "rule": "decimal",
                            "message": f"PremiumAmount must be a valid decimal number, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

            # CoverageType: must be one of the valid values
            elif field == "CoverageType":
                if value not in VALID_COVERAGE_TYPES:
                    errors.append(
                        {
                            "field": field,
                            "rule": "coverage_type_enum",
                            "message": f"CoverageType must be one of {sorted(VALID_COVERAGE_TYPES)}, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

    # Cross-field: ExpiryDate must be after EffectiveDate
    if "EffectiveDate" in field_values and "ExpiryDate" in field_values:
        eff = parse_date(field_values["EffectiveDate"])
        exp = parse_date(field_values["ExpiryDate"])
        if eff is not None and exp is not None:
            if exp <= eff:
                errors.append(
                    {
                        "field": "ExpiryDate",
                        "rule": "expiry_after_effective",
                        "message": f"ExpiryDate ({field_values['ExpiryDate']}) must be after EffectiveDate ({field_values['EffectiveDate']})",
                        "line": find_line(content, "ExpiryDate"),
                        "severity": "error",
                    }
                )

    status = "fail" if errors else "pass"
    return {"filename": filename, "status": status, "errors": errors}
