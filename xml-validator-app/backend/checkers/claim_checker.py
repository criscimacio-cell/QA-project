import xml.etree.ElementTree as ET
import re


def _get_line(content: str, tag: str):
    """Return approximate 1-based line number where <tag appears in raw XML."""
    for i, line in enumerate(content.splitlines(), start=1):
        if f"<{tag}" in line:
            return i
    return None


def check(filename: str, content: str) -> dict:
    """Validate a Claim XML document.

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
    if root.tag not in ("Claim", "ClaimSet"):
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": (
                    f"Invalid root element <{root.tag}>. "
                    "Expected <Claim> or <ClaimSet>."
                ),
                "line": 1,
                "severity": "error",
            }
        )

    # --- Collect claim nodes to validate ---
    if root.tag == "ClaimSet":
        claim_nodes = root.findall("Claim")
        if not claim_nodes:
            errors.append(
                {
                    "field": "ClaimSet",
                    "rule": "non_empty",
                    "message": "ClaimSet must contain at least one <Claim> child element.",
                    "line": 1,
                    "severity": "error",
                }
            )
    else:
        claim_nodes = [root]

    for node in claim_nodes:
        _validate_claim_node(node, content, errors)

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }


def _get_field_text(node, tag: str):
    """Return stripped text of first matching child element, or None."""
    elem = node.find(tag)
    if elem is not None and elem.text:
        return elem.text.strip()
    return None


def _validate_claim_node(node, content: str, errors: list):
    required_fields = [
        "ClaimID",
        "PatientName",
        "ServiceDate",
        "DiagnosisCode",
        "ProcedureCode",
        "BilledAmount",
    ]

    field_values = {}
    for field in required_fields:
        value = _get_field_text(node, field)
        line = _get_line(content, field)
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

    # ServiceDate: YYYY-MM-DD
    if "ServiceDate" in field_values:
        val = field_values["ServiceDate"]
        line = _get_line(content, "ServiceDate")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", val):
            errors.append(
                {
                    "field": "ServiceDate",
                    "rule": "date_format",
                    "message": (
                        f"ServiceDate '{val}' does not match YYYY-MM-DD format."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )

    # BilledAmount: positive number
    if "BilledAmount" in field_values:
        val = field_values["BilledAmount"]
        line = _get_line(content, "BilledAmount")
        try:
            amount = float(val)
            if amount <= 0:
                errors.append(
                    {
                        "field": "BilledAmount",
                        "rule": "positive_number",
                        "message": (
                            f"BilledAmount '{val}' must be a positive number."
                        ),
                        "line": line,
                        "severity": "error",
                    }
                )
        except ValueError:
            errors.append(
                {
                    "field": "BilledAmount",
                    "rule": "numeric",
                    "message": f"BilledAmount '{val}' is not a valid number.",
                    "line": line,
                    "severity": "error",
                }
            )

    # DiagnosisCode: [A-Z]\d{2,5}
    if "DiagnosisCode" in field_values:
        val = field_values["DiagnosisCode"]
        line = _get_line(content, "DiagnosisCode")
        if not re.fullmatch(r"[A-Z]\d{2,5}", val):
            errors.append(
                {
                    "field": "DiagnosisCode",
                    "rule": "format",
                    "message": (
                        f"DiagnosisCode '{val}' must match pattern "
                        r"[A-Z]\d{2,5} (e.g. A123)."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )

    # ProcedureCode: exactly 5 digits
    if "ProcedureCode" in field_values:
        val = field_values["ProcedureCode"]
        line = _get_line(content, "ProcedureCode")
        if not re.fullmatch(r"\d{5}", val):
            errors.append(
                {
                    "field": "ProcedureCode",
                    "rule": "format",
                    "message": (
                        f"ProcedureCode '{val}' must be exactly 5 digits."
                    ),
                    "line": line,
                    "severity": "error",
                }
            )
