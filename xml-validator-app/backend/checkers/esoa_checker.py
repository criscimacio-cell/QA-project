import xml.etree.ElementTree as ET
import re
from datetime import datetime


def _get_line(content: str, tag: str):
    """Return approximate 1-based line number where <tag appears in raw XML."""
    for i, line in enumerate(content.splitlines(), start=1):
        if f"<{tag}" in line:
            return i
    return None


VALID_COVERAGE_TYPES = {"HEALTH", "LIFE", "PROPERTY", "AUTO"}
DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")


def check(filename: str, content: str) -> dict:
    """Validate an ESOA XML document.

    Returns:
        dict with keys: filename, status ('pass'|'fail'),
        errors (list of {field, rule, message, line, severity})
    """
    errors = []

    # --- Parse XML ---
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        line_no = exc.position[0] if hasattr(exc, "position") else None
        return {
            "filename": filename,
            "status": "fail",
            "errors": [
                {
                    "field": "XML",
                    "rule": "well_formed",
                    "message": f"XML parse error: {exc}",
                    "line": line_no,
                    "severity": "error",
                }
            ],
        }

    # --- Validate root element ---
    if root.tag not in ("ESOA", "ESOADocument"):
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": (
                    f"Invalid root element <{root.tag}>. "
                    "Expected <ESOA> or <ESOADocument>."
                ),
                "line": 1,
                "severity": "error",
            }
        )

    required_fields = [
        "SOAID",
        "EffectiveDate",
        "ExpiryDate",
        "CoverageType",
        "PremiumAmount",
        "InsuredName",
    ]

    field_values = {}
    for field in required_fields:
        elem = root.find(field)
        line = _get_line(content, field)
        value = (elem.text or "").strip() if elem is not None else ""
        if not value:
            errors.append(
                {
                    "field": field,
                    "rule": "required",
                    "message": f"Required field <{field}> is missing or empty.",
                    "line": line,
                    "severity": "error",
                }
            )
        else:
            field_values[field] = value

    # EffectiveDate: YYYY-MM-DD and valid calendar date
    effective_dt = None
    if "EffectiveDate" in field_values:
        val = field_values["EffectiveDate"]
        line = _get_line(content, "EffectiveDate")
        if not DATE_PATTERN.fullmatch(val):
            errors.append(
                {
                    "field": "EffectiveDate",
                    "rule": "date_format",
                    "message": (
                        f"EffectiveDate '{val}' does not match YYYY-MM-DD format."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )
        else:
            try:
                effective_dt = datetime.strptime(val, "%Y-%m-%d")
            except ValueError:
                errors.append(
                    {
                        "field": "EffectiveDate",
                        "rule": "date_valid",
                        "message": (
                            f"EffectiveDate '{val}' is not a valid calendar date."
                        ),
                        "line": line,
                        "severity": "error",
                    }
                )

    # ExpiryDate: YYYY-MM-DD and valid calendar date
    expiry_dt = None
    if "ExpiryDate" in field_values:
        val = field_values["ExpiryDate"]
        line = _get_line(content, "ExpiryDate")
        if not DATE_PATTERN.fullmatch(val):
            errors.append(
                {
                    "field": "ExpiryDate",
                    "rule": "date_format",
                    "message": (
                        f"ExpiryDate '{val}' does not match YYYY-MM-DD format."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )
        else:
            try:
                expiry_dt = datetime.strptime(val, "%Y-%m-%d")
            except ValueError:
                errors.append(
                    {
                        "field": "ExpiryDate",
                        "rule": "date_valid",
                        "message": (
                            f"ExpiryDate '{val}' is not a valid calendar date."
                        ),
                        "line": line,
                        "severity": "error",
                    }
                )

    # ExpiryDate must be after EffectiveDate
    if effective_dt is not None and expiry_dt is not None:
        if expiry_dt <= effective_dt:
            errors.append(
                {
                    "field": "ExpiryDate",
                    "rule": "expiry_after_effective",
                    "message": (
                        f"ExpiryDate '{field_values['ExpiryDate']}' must be "
                        f"after EffectiveDate '{field_values['EffectiveDate']}'."
                    ),
                    "line": _get_line(content, "ExpiryDate"),
                    "severity": "error",
                }
            )

    # PremiumAmount: positive decimal
    if "PremiumAmount" in field_values:
        val = field_values["PremiumAmount"]
        line = _get_line(content, "PremiumAmount")
        try:
            amount = float(val)
            if amount <= 0:
                errors.append(
                    {
                        "field": "PremiumAmount",
                        "rule": "positive_number",
                        "message": (
                            f"PremiumAmount '{val}' must be a positive decimal."
                        ),
                        "line": line,
                        "severity": "error",
                    }
                )
        except ValueError:
            errors.append(
                {
                    "field": "PremiumAmount",
                    "rule": "valid_decimal",
                    "message": (
                        f"PremiumAmount '{val}' is not a valid decimal number."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )

    # CoverageType: one of HEALTH, LIFE, PROPERTY, AUTO
    if "CoverageType" in field_values:
        val = field_values["CoverageType"]
        line = _get_line(content, "CoverageType")
        if val not in VALID_COVERAGE_TYPES:
            errors.append(
                {
                    "field": "CoverageType",
                    "rule": "allowed_value",
                    "message": (
                        f"CoverageType '{val}' must be one of: "
                        "HEALTH, LIFE, PROPERTY, AUTO."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
