import xml.etree.ElementTree as ET
import re


REQUIRED_FIELDS = [
    "ClaimID",
    "PatientName",
    "ServiceDate",
    "DiagnosisCode",
    "ProcedureCode",
    "BilledAmount",
]

VALID_ROOTS = {"Claim", "ClaimSet"}


def find_line(xml_string: str, tag: str) -> int:
    """Approximate line number of a tag in the XML string."""
    lines = xml_string.splitlines()
    for i, line in enumerate(lines, start=1):
        if f"<{tag}" in line or f"<{tag}>" in line:
            return i
    return 0


def check_claim(filename: str, content: str) -> dict:
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
                    "line": getattr(e, "position", (0, 0))[0] if hasattr(e, "position") else 0,
                    "severity": "error",
                }
            ],
        }

    # Check root element
    root_tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if root_tag not in VALID_ROOTS:
        errors.append(
            {
                "field": "root",
                "rule": "valid_root",
                "message": f"Root element must be <Claim> or <ClaimSet>, got <{root_tag}>",
                "line": 1,
                "severity": "error",
            }
        )

    # Helper to find a field value (search recursively)
    def get_field(tag):
        el = root.find(f".//{tag}")
        return el

    # Check required fields
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
            line = find_line(content, field)

            # ServiceDate: YYYY-MM-DD
            if field == "ServiceDate":
                if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
                    errors.append(
                        {
                            "field": field,
                            "rule": "date_format",
                            "message": f"ServiceDate must be in YYYY-MM-DD format, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

            # BilledAmount: positive number
            elif field == "BilledAmount":
                try:
                    amount = float(value)
                    if amount <= 0:
                        errors.append(
                            {
                                "field": field,
                                "rule": "positive_number",
                                "message": f"BilledAmount must be a positive number, got '{value}'",
                                "line": line,
                                "severity": "error",
                            }
                        )
                except ValueError:
                    errors.append(
                        {
                            "field": field,
                            "rule": "numeric",
                            "message": f"BilledAmount must be a valid number, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

            # DiagnosisCode: [A-Z]\d{2,5}
            elif field == "DiagnosisCode":
                if not re.match(r"^[A-Z]\d{2,5}$", value):
                    errors.append(
                        {
                            "field": field,
                            "rule": "diagnosis_code_format",
                            "message": f"DiagnosisCode must match pattern [A-Z]\\d{{2,5}}, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

            # ProcedureCode: exactly 5 digits
            elif field == "ProcedureCode":
                if not re.match(r"^\d{5}$", value):
                    errors.append(
                        {
                            "field": field,
                            "rule": "procedure_code_format",
                            "message": f"ProcedureCode must be exactly 5 digits, got '{value}'",
                            "line": line,
                            "severity": "error",
                        }
                    )

    status = "fail" if errors else "pass"
    return {"filename": filename, "status": status, "errors": errors}
