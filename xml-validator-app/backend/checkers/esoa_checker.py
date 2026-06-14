import xml.etree.ElementTree as ET
import re
from datetime import datetime


def get_approx_line(xml_string, tag):
    """Find approximate line number of a tag in raw XML string."""
    pattern = f"<{tag}"
    idx = xml_string.find(pattern)
    if idx == -1:
        return None
    return xml_string[:idx].count('\n') + 1


VALID_COVERAGE_TYPES = {"HEALTH", "LIFE", "PROPERTY", "AUTO"}
DATE_FORMAT = "%Y-%m-%d"


def check_esoa(filename, content):
    errors = []

    # Parse XML
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        return {
            "filename": filename,
            "status": "fail",
            "errors": [{
                "field": "root",
                "rule": "valid_xml",
                "message": f"XML parse error: {e}",
                "line": None,
                "severity": "error"
            }]
        }

    # Check root element
    if root.tag not in ("ESOA", "ESOADocument"):
        errors.append({
            "field": "root",
            "rule": "valid_root",
            "message": f"Root element must be <ESOA> or <ESOADocument>, got <{root.tag}>",
            "line": 1,
            "severity": "error"
        })

    required_fields = [
        "SOAID", "EffectiveDate", "ExpiryDate",
        "CoverageType", "PremiumAmount", "InsuredName"
    ]

    field_values = {}

    for field in required_fields:
        elem = root.find(field)
        if elem is None or (elem.text is None or elem.text.strip() == ""):
            line = get_approx_line(content, field)
            errors.append({
                "field": field,
                "rule": "required",
                "message": f"Required field <{field}> is missing or empty",
                "line": line,
                "severity": "error"
            })
            continue

        value = elem.text.strip()
        line = get_approx_line(content, field)
        field_values[field] = value

        if field in ("EffectiveDate", "ExpiryDate"):
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', value):
                errors.append({
                    "field": field,
                    "rule": "date_format",
                    "message": f"{field} must match YYYY-MM-DD format, got '{value}'",
                    "line": line,
                    "severity": "error"
                })
            else:
                try:
                    field_values[field + "_dt"] = datetime.strptime(value, DATE_FORMAT)
                except ValueError:
                    errors.append({
                        "field": field,
                        "rule": "valid_date",
                        "message": f"{field} is not a valid calendar date: '{value}'",
                        "line": line,
                        "severity": "error"
                    })

        elif field == "PremiumAmount":
            try:
                amount = float(value)
                if amount <= 0:
                    errors.append({
                        "field": field,
                        "rule": "positive_decimal",
                        "message": f"PremiumAmount must be a positive decimal, got '{value}'",
                        "line": line,
                        "severity": "error"
                    })
            except ValueError:
                errors.append({
                    "field": field,
                    "rule": "valid_decimal",
                    "message": f"PremiumAmount must be a valid decimal number, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field == "CoverageType":
            if value not in VALID_COVERAGE_TYPES:
                errors.append({
                    "field": field,
                    "rule": "valid_coverage_type",
                    "message": f"CoverageType must be one of {sorted(VALID_COVERAGE_TYPES)}, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

    # Cross-field date validation
    eff_dt = field_values.get("EffectiveDate_dt")
    exp_dt = field_values.get("ExpiryDate_dt")

    if eff_dt is not None and exp_dt is not None:
        if exp_dt <= eff_dt:
            exp_line = get_approx_line(content, "ExpiryDate")
            errors.append({
                "field": "ExpiryDate",
                "rule": "expiry_after_effective",
                "message": f"ExpiryDate ({field_values.get('ExpiryDate')}) must be after EffectiveDate ({field_values.get('EffectiveDate')})",
                "line": exp_line,
                "severity": "error"
            })

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
