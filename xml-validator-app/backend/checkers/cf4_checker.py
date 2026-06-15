import xml.etree.ElementTree as ET
import re


REQUIRED_FIELDS = [
    "FormID",
    "SubmitterID",
    "TaxYear",
    "GrossIncome",
    "TaxableIncome",
    "TaxDue",
    "TaxPaid",
]

VALID_ROOTS = {"CF4", "CF4Form"}


def get_approx_line(xml_string, tag):
    pattern = f"<{tag}"
    idx = xml_string.find(pattern)
    if idx == -1:
        return None
    return xml_string[:idx].count('\n') + 1


def check_cf4(filename, content):
    errors = []

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

    root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if root_tag not in VALID_ROOTS:
        errors.append({
            "field": "root",
            "rule": "valid_root",
            "message": f"Root element must be <CF4> or <CF4Form>, got <{root_tag}>",
            "line": 1,
            "severity": "error"
        })

    field_values = {}

    for field in REQUIRED_FIELDS:
        elem = root.find(f".//{field}")
        if elem is None or (elem.text is None or elem.text.strip() == ""):
            errors.append({
                "field": field,
                "rule": "required",
                "message": f"Required field <{field}> is missing or empty",
                "line": get_approx_line(content, field),
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
                    "message": f"TaxYear must be a 4-digit year between 2000 and 2099, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field in ("GrossIncome", "TaxableIncome", "TaxDue", "TaxPaid"):
            try:
                float(value)
            except ValueError:
                errors.append({
                    "field": field,
                    "rule": "decimal",
                    "message": f"{field} must be a valid decimal number, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

    # Cross-field: TaxableIncome <= GrossIncome
    if "TaxableIncome" in field_values and "GrossIncome" in field_values:
        try:
            if float(field_values["TaxableIncome"]) > float(field_values["GrossIncome"]):
                errors.append({
                    "field": "TaxableIncome",
                    "rule": "taxable_lte_gross",
                    "message": f"TaxableIncome ({field_values['TaxableIncome']}) must be <= GrossIncome ({field_values['GrossIncome']})",
                    "line": get_approx_line(content, "TaxableIncome"),
                    "severity": "error"
                })
        except ValueError:
            pass

    # Cross-field: TaxDue and TaxPaid must be >= 0
    for field in ("TaxDue", "TaxPaid"):
        if field in field_values:
            try:
                if float(field_values[field]) < 0:
                    errors.append({
                        "field": field,
                        "rule": "non_negative",
                        "message": f"{field} must be >= 0, got '{field_values[field]}'",
                        "line": get_approx_line(content, field),
                        "severity": "error"
                    })
            except ValueError:
                pass

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
