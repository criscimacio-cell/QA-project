import xml.etree.ElementTree as ET
import re


REQUIRED_FIELDS = [
    "FormID",
    "SubmitterID",
    "TaxYear",
    "GrossAmount",
    "NetAmount",
    "TaxWithheld",
]

VALID_ROOTS = {"CF5", "CF5Form"}


def find_line(xml_string: str, tag: str) -> int:
    lines = xml_string.splitlines()
    for i, line in enumerate(lines, start=1):
        if f"<{tag}" in line or f"<{tag}>" in line:
            return i
    return 0


def check_cf5(filename: str, content: str) -> dict:
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
                "message": f"Root element must be <CF5> or <CF5Form>, got <{root_tag}>",
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

            # TaxYear: 4-digit year 2000-2099
            if field == "TaxYear":
                if not re.match(r"^\d{4}$", value) or not (2000 <= int(value) <= 2099):
                    errors.append(
                        {
                            "field": field,
                            "rule": "tax_year_range",
                            "message": f"TaxYear must be a 4-digit year between 2000 and 2099, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

            # GrossAmount, NetAmount, TaxWithheld: valid decimals
            elif field in ("GrossAmount", "NetAmount", "TaxWithheld"):
                try:
                    float(value)
                except ValueError:
                    errors.append(
                        {
                            "field": field,
                            "rule": "decimal",
                            "message": f"{field} must be a valid decimal number, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

    # Cross-field: TaxWithheld >= 0
    if "TaxWithheld" in field_values:
        try:
            tw = float(field_values["TaxWithheld"])
            if tw < 0:
                errors.append(
                    {
                        "field": "TaxWithheld",
                        "rule": "non_negative",
                        "message": f"TaxWithheld must be >= 0, got '{field_values['TaxWithheld']}'",
                        "line": find_line(content, "TaxWithheld"),
                        "severity": "error",
                    }
                )
        except ValueError:
            pass

    # Cross-field: NetAmount <= GrossAmount
    if "NetAmount" in field_values and "GrossAmount" in field_values:
        try:
            net = float(field_values["NetAmount"])
            gross = float(field_values["GrossAmount"])
            if net > gross:
                errors.append(
                    {
                        "field": "NetAmount",
                        "rule": "net_lte_gross",
                        "message": f"NetAmount ({field_values['NetAmount']}) must be <= GrossAmount ({field_values['GrossAmount']})",
                        "line": find_line(content, "NetAmount"),
                        "severity": "error",
                    }
                )
        except ValueError:
            pass

    status = "fail" if errors else "pass"
    return {"filename": filename, "status": status, "errors": errors}
