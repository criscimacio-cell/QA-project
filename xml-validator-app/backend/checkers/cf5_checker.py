import xml.etree.ElementTree as ET
import re


def get_approx_line(xml_string, tag):
    """Find approximate line number of a tag in raw XML string."""
    pattern = f"<{tag}"
    idx = xml_string.find(pattern)
    if idx == -1:
        return None
    return xml_string[:idx].count('\n') + 1


def check_cf5(filename, content):
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
    if root.tag not in ("CF5", "CF5Form"):
        errors.append({
            "field": "root",
            "rule": "valid_root",
            "message": f"Root element must be <CF5> or <CF5Form>, got <{root.tag}>",
            "line": 1,
            "severity": "error"
        })

    required_fields = [
        "FormID", "SubmitterID", "TaxYear",
        "GrossAmount", "NetAmount", "TaxWithheld"
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

        if field == "TaxYear":
            if not re.match(r'^\d{4}$', value) or not (2000 <= int(value) <= 2099):
                errors.append({
                    "field": field,
                    "rule": "tax_year_range",
                    "message": f"TaxYear must be a 4-digit year between 2000-2099, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field in ("GrossAmount", "NetAmount", "TaxWithheld"):
            try:
                float(value)
                field_values[field + "_float"] = float(value)
            except ValueError:
                errors.append({
                    "field": field,
                    "rule": "valid_decimal",
                    "message": f"{field} must be a valid decimal number, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

    # Cross-field validations
    gross = field_values.get("GrossAmount_float")
    net = field_values.get("NetAmount_float")
    withheld = field_values.get("TaxWithheld_float")

    if net is not None and gross is not None:
        if net > gross:
            net_line = get_approx_line(content, "NetAmount")
            errors.append({
                "field": "NetAmount",
                "rule": "net_lte_gross",
                "message": f"NetAmount ({net}) must be less than or equal to GrossAmount ({gross})",
                "line": net_line,
                "severity": "error"
            })

    if withheld is not None:
        if withheld < 0:
            withheld_line = get_approx_line(content, "TaxWithheld")
            errors.append({
                "field": "TaxWithheld",
                "rule": "non_negative",
                "message": f"TaxWithheld must be >= 0, got '{withheld}'",
                "line": withheld_line,
                "severity": "error"
            })

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
