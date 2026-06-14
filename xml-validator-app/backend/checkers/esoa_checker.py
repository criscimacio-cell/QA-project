import xml.etree.ElementTree as ET
import re
from datetime import datetime


def check(filename: str, content: str) -> dict:
    errors = []

    # Parse XML
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
                    "line": e.position[0] if hasattr(e, "position") else None,
                    "severity": "error",
                }
            ],
        }

    # Validate root element
    valid_roots = {"ESOA", "ESOADocument"}
    if root.tag not in valid_roots:
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": f"Invalid root element <{root.tag}>. Expected <ESOA> or <ESOADocument>.",
                "line": 1,
                "severity": "error",
            }
        )

    # Helper to get approximate line number for a field tag
    def get_line(tag: str):
        lines = content.splitlines()
        for i, line in enumerate(lines, start=1):
            if f"<{tag}" in line:
                return i
        return None

    # Helper to get text from direct child or nested children
    def get_field(tag: str):
        elem = root.find(tag)
        if elem is None:
            for child in root:
                elem = child.find(tag)
                if elem is not None:
                    break
        if elem is not None:
            return (elem.text or "").strip()
        return None

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
        value = get_field(field)
        if value is None or value == "":
            errors.append(
                {
                    "field": field,
                    "rule": "required",
                    "message": f"Required field <{field}> is missing or empty.",
                    "line": get_line(field),
                    "severity": "error",
                }
            )
        else:
            field_values[field] = value

    date_pattern = re.compile(r"\d{4}-\d{2}-\d{2}")

    # Validate EffectiveDate
    effective_dt = None
    if "EffectiveDate" in field_values:
        val = field_values["EffectiveDate"]
        if not date_pattern.fullmatch(val):
            errors.append(
                {
                    "field": "EffectiveDate",
                    "rule": "date_format",
                    "message": f"EffectiveDate '{val}' does not match YYYY-MM-DD format.",
                    "line": get_line("EffectiveDate"),
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
                        "message": f"EffectiveDate '{val}' is not a valid calendar date.",
                        "line": get_line("EffectiveDate"),
                        "severity": "error",
                    }
                )

    # Validate ExpiryDate
    expiry_dt = None
    if "ExpiryDate" in field_values:
        val = field_values["ExpiryDate"]
        if not date_pattern.fullmatch(val):
            errors.append(
                {
                    "field": "ExpiryDate",
                    "rule": "date_format",
                    "message": f"ExpiryDate '{val}' does not match YYYY-MM-DD format.",
                    "line": get_line("ExpiryDate"),
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
                        "message": f"ExpiryDate '{val}' is not a valid calendar date.",
                        "line": get_line("ExpiryDate"),
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
                    "message": f"ExpiryDate '{field_values['ExpiryDate']}' must be after EffectiveDate '{field_values['EffectiveDate']}'.",
                    "line": get_line("ExpiryDate"),
                    "severity": "error",
                }
            )

    # Validate PremiumAmount: positive decimal
    if "PremiumAmount" in field_values:
        val = field_values["PremiumAmount"]
        try:
            amount = float(val)
            if amount <= 0:
                errors.append(
                    {
                        "field": "PremiumAmount",
                        "rule": "positive_number",
                        "message": f"PremiumAmount '{val}' must be a positive decimal.",
                        "line": get_line("PremiumAmount"),
                        "severity": "error",
                    }
                )
        except ValueError:
            errors.append(
                {
                    "field": "PremiumAmount",
                    "rule": "numeric",
                    "message": f"PremiumAmount '{val}' is not a valid decimal number.",
                    "line": get_line("PremiumAmount"),
                    "severity": "error",
                }
            )

    # Validate CoverageType
    valid_coverage_types = {"HEALTH", "LIFE", "PROPERTY", "AUTO"}
    if "CoverageType" in field_values:
        val = field_values["CoverageType"]
        if val not in valid_coverage_types:
            errors.append(
                {
                    "field": "CoverageType",
                    "rule": "allowed_value",
                    "message": f"CoverageType '{val}' must be one of: HEALTH, LIFE, PROPERTY, AUTO.",
                    "line": get_line("CoverageType"),
                    "severity": "error",
                }
            )

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
