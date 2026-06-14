import xml.etree.ElementTree as ET
import re


def check_cf5(filename: str, content: str) -> dict:
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
    valid_roots = {"CF5", "CF5Form"}
    if root.tag not in valid_roots:
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": f"Invalid root element <{root.tag}>. Expected <CF5> or <CF5Form>.",
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
        "FormID",
        "SubmitterID",
        "TaxYear",
        "GrossAmount",
        "NetAmount",
        "TaxWithheld",
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

    # Validate TaxYear: 4-digit year between 2000-2099
    if "TaxYear" in field_values:
        val = field_values["TaxYear"]
        if not re.fullmatch(r"\d{4}", val):
            errors.append(
                {
                    "field": "TaxYear",
                    "rule": "year_format",
                    "message": f"TaxYear '{val}' must be a 4-digit year.",
                    "line": get_line("TaxYear"),
                    "severity": "error",
                }
            )
        else:
            year = int(val)
            if not (2000 <= year <= 2099):
                errors.append(
                    {
                        "field": "TaxYear",
                        "rule": "year_range",
                        "message": f"TaxYear '{val}' must be between 2000 and 2099.",
                        "line": get_line("TaxYear"),
                        "severity": "error",
                    }
                )

    # Parse numeric fields
    def parse_decimal(field_name: str):
        val = field_values.get(field_name)
        if val is None:
            return None
        try:
            return float(val)
        except ValueError:
            errors.append(
                {
                    "field": field_name,
                    "rule": "numeric",
                    "message": f"{field_name} '{val}' is not a valid decimal number.",
                    "line": get_line(field_name),
                    "severity": "error",
                }
            )
            return None

    gross = parse_decimal("GrossAmount")
    net = parse_decimal("NetAmount")
    tax = parse_decimal("TaxWithheld")

    # TaxWithheld >= 0
    if tax is not None and tax < 0:
        errors.append(
            {
                "field": "TaxWithheld",
                "rule": "non_negative",
                "message": f"TaxWithheld '{field_values['TaxWithheld']}' must be >= 0.",
                "line": get_line("TaxWithheld"),
                "severity": "error",
            }
        )

    # NetAmount <= GrossAmount
    if gross is not None and net is not None:
        if net > gross:
            errors.append(
                {
                    "field": "NetAmount",
                    "rule": "net_lte_gross",
                    "message": f"NetAmount '{field_values['NetAmount']}' must be <= GrossAmount '{field_values['GrossAmount']}'.",
                    "line": get_line("NetAmount"),
                    "severity": "error",
                }
            )

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
