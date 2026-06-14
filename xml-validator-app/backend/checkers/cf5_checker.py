import xml.etree.ElementTree as ET
import re


def _get_line(content: str, tag: str):
    """Return approximate 1-based line number where <tag appears in raw XML."""
    for i, line in enumerate(content.splitlines(), start=1):
        if f"<{tag}" in line:
            return i
    return None


def check(filename: str, content: str) -> dict:
    """Validate a CF5 XML document.

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
    if root.tag not in ("CF5", "CF5Form"):
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": (
                    f"Invalid root element <{root.tag}>. "
                    "Expected <CF5> or <CF5Form>."
                ),
                "line": 1,
                "severity": "error",
            }
        )

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

    # TaxYear: 4-digit year between 2000-2099
    if "TaxYear" in field_values:
        val = field_values["TaxYear"]
        line = _get_line(content, "TaxYear")
        if not re.fullmatch(r"\d{4}", val):
            errors.append(
                {
                    "field": "TaxYear",
                    "rule": "year_format",
                    "message": f"TaxYear '{val}' must be a 4-digit year.",
                    "line": line,
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
                        "message": (
                            f"TaxYear '{val}' must be between 2000 and 2099."
                        ),
                        "line": line,
                        "severity": "error",
                    }
                )

    # Helper: parse a decimal field, recording an error if invalid
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
                    "rule": "valid_decimal",
                    "message": (
                        f"{field_name} '{val}' is not a valid decimal number."
                    ),
                    "line": _get_line(content, field_name),
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
                "message": (
                    f"TaxWithheld '{field_values['TaxWithheld']}' must be >= 0."
                ),
                "line": _get_line(content, "TaxWithheld"),
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
                    "message": (
                        f"NetAmount '{field_values['NetAmount']}' must be "
                        f"<= GrossAmount '{field_values['GrossAmount']}'."
                    ),
                    "line": _get_line(content, "NetAmount"),
                    "severity": "error",
                }
            )

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
