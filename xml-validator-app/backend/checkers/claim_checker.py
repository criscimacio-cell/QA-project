import xml.etree.ElementTree as ET
import re


def get_approx_line(xml_string, tag):
    """Find approximate line number of a tag in raw XML string."""
    pattern = f"<{tag}"
    idx = xml_string.find(pattern)
    if idx == -1:
        return None
    return xml_string[:idx].count('\n') + 1


def check_claim(filename, content):
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
    if root.tag not in ("Claim", "ClaimSet"):
        errors.append({
            "field": "root",
            "rule": "valid_root",
            "message": f"Root element must be <Claim> or <ClaimSet>, got <{root.tag}>",
            "line": 1,
            "severity": "error"
        })

    # If root is ClaimSet, validate child Claim elements; otherwise validate root directly
    if root.tag == "ClaimSet":
        claims = root.findall("Claim")
        if not claims:
            errors.append({
                "field": "ClaimSet",
                "rule": "has_claims",
                "message": "ClaimSet must contain at least one <Claim> element",
                "line": 1,
                "severity": "error"
            })
        for claim in claims:
            errors.extend(_validate_claim_fields(claim, content))
    else:
        errors.extend(_validate_claim_fields(root, content))

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}


def _validate_claim_fields(node, xml_string):
    errors = []
    required_fields = [
        "ClaimID", "PatientName", "ServiceDate",
        "DiagnosisCode", "ProcedureCode", "BilledAmount"
    ]

    for field in required_fields:
        elem = node.find(field)
        if elem is None or (elem.text is None or elem.text.strip() == ""):
            line = get_approx_line(xml_string, field)
            errors.append({
                "field": field,
                "rule": "required",
                "message": f"Required field <{field}> is missing or empty",
                "line": line,
                "severity": "error"
            })
            continue

        value = elem.text.strip()
        line = get_approx_line(xml_string, field)

        if field == "ServiceDate":
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', value):
                errors.append({
                    "field": field,
                    "rule": "date_format",
                    "message": f"ServiceDate must match YYYY-MM-DD format, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field == "BilledAmount":
            try:
                amount = float(value)
                if amount <= 0:
                    errors.append({
                        "field": field,
                        "rule": "positive_number",
                        "message": f"BilledAmount must be a positive number, got '{value}'",
                        "line": line,
                        "severity": "error"
                    })
            except ValueError:
                errors.append({
                    "field": field,
                    "rule": "valid_number",
                    "message": f"BilledAmount must be a valid number, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field == "DiagnosisCode":
            if not re.match(r'^[A-Z]\d{2,5}$', value):
                errors.append({
                    "field": field,
                    "rule": "diagnosis_code_format",
                    "message": f"DiagnosisCode must match [A-Z]\\d{{2,5}}, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

        elif field == "ProcedureCode":
            if not re.match(r'^\d{5}$', value):
                errors.append({
                    "field": field,
                    "rule": "procedure_code_format",
                    "message": f"ProcedureCode must be exactly 5 digits, got '{value}'",
                    "line": line,
                    "severity": "error"
                })

    return errors
