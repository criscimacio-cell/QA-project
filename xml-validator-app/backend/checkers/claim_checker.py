import xml.etree.ElementTree as ET
import re


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
    valid_roots = {"Claim", "ClaimSet"}
    if root.tag not in valid_roots:
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": f"Invalid root element <{root.tag}>. Expected <Claim> or <ClaimSet>.",
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
        "ClaimID",
        "PatientName",
        "ServiceDate",
        "DiagnosisCode",
        "ProcedureCode",
        "BilledAmount",
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

    # Validate ServiceDate: YYYY-MM-DD
    if "ServiceDate" in field_values:
        val = field_values["ServiceDate"]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", val):
            errors.append(
                {
                    "field": "ServiceDate",
                    "rule": "date_format",
                    "message": f"ServiceDate '{val}' does not match YYYY-MM-DD format.",
                    "line": get_line("ServiceDate"),
                    "severity": "error",
                }
            )

    # Validate BilledAmount: positive number
    if "BilledAmount" in field_values:
        val = field_values["BilledAmount"]
        try:
            amount = float(val)
            if amount <= 0:
                errors.append(
                    {
                        "field": "BilledAmount",
                        "rule": "positive_number",
                        "message": f"BilledAmount '{val}' must be a positive number.",
                        "line": get_line("BilledAmount"),
                        "severity": "error",
                    }
                )
        except ValueError:
            errors.append(
                {
                    "field": "BilledAmount",
                    "rule": "numeric",
                    "message": f"BilledAmount '{val}' is not a valid number.",
                    "line": get_line("BilledAmount"),
                    "severity": "error",
                }
            )

    # Validate DiagnosisCode: [A-Z]\d{2,5}
    if "DiagnosisCode" in field_values:
        val = field_values["DiagnosisCode"]
        if not re.fullmatch(r"[A-Z]\d{2,5}", val):
            errors.append(
                {
                    "field": "DiagnosisCode",
                    "rule": "format",
                    "message": f"DiagnosisCode '{val}' must match pattern [A-Z]\\d{{2,5}} (e.g., A123).",
                    "line": get_line("DiagnosisCode"),
                    "severity": "error",
                }
            )

    # Validate ProcedureCode: exactly 5 digits
    if "ProcedureCode" in field_values:
        val = field_values["ProcedureCode"]
        if not re.fullmatch(r"\d{5}", val):
            errors.append(
                {
                    "field": "ProcedureCode",
                    "rule": "format",
                    "message": f"ProcedureCode '{val}' must be exactly 5 digits.",
                    "line": get_line("ProcedureCode"),
                    "severity": "error",
                }
            )

    return {
        "filename": filename,
        "status": "fail" if errors else "pass",
        "errors": errors,
    }
