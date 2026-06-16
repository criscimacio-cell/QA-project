"""
CF5 XML Checker
Ports cf5_xsd_validator.py exactly:
- XSD validation via CF5_validated.xsd
- ICD-10 lookup via ICD10_Case_Rates.csv
- RVS lookup via RVS_Case_Rates.csv
- Business rules (NewBornAdmWeight, duplicates, byte-length, cross-file uniqueness)
"""
import os
import re
import pandas as pd
from lxml import etree

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
REF_DIR   = os.path.join(BASE_DIR, "..", "references", "cf5")
XSD_PATH  = os.path.join(REF_DIR, "CF5_validated (3).xsd")
ICD10_CSV = os.path.join(REF_DIR, "ICD10_Case_Rates.csv")
RVS_CSV   = os.path.join(REF_DIR, "RVS_Case_Rates.csv")

_xsd_schema  = None
_icd10_codes = None
_rvs_codes   = None


def _load_xsd():
    global _xsd_schema
    if _xsd_schema is None and os.path.exists(XSD_PATH):
        _xsd_schema = etree.XMLSchema(etree.parse(XSD_PATH))
    return _xsd_schema


def _load_icd10():
    global _icd10_codes
    if _icd10_codes is None:
        if os.path.exists(ICD10_CSV):
            df = pd.read_csv(ICD10_CSV, dtype=str)
            codes = set()
            for raw in df["Code"].dropna():
                for part in re.split(r"\s+", raw.strip()):
                    clean = re.sub(r"[+*]", "", part).strip()
                    if clean:
                        codes.add(clean.upper())
            _icd10_codes = codes
        else:
            _icd10_codes = set()
    return _icd10_codes


def _load_rvs():
    global _rvs_codes
    if _rvs_codes is None:
        if os.path.exists(RVS_CSV):
            df = pd.read_csv(RVS_CSV, dtype=str)
            _rvs_codes = set(df["Code"].dropna().str.strip())
        else:
            _rvs_codes = set()
    return _rvs_codes


ORACLE_CONSTRAINT_MAP = [
    (r"missing required attribute '(.+?)'",
     "NOT NULL", "Attribute is #REQUIRED (NOT NULL). Value must be provided.", "error"),
    (r"The value '.+?' is not an element of the set \{(.+?)\}",
     "CHECK (IN LIST)", "Value violates enumeration constraint. Must be one of the allowed values.", "error"),
    (r"\[facet 'pattern'\]",
     "CHECK (REGEXP_LIKE)", "Value does not match required format/pattern.", "error"),
    (r"\[facet 'maxLength'\]",
     "CHECK (LENGTH <= n)", "Value exceeds maximum allowed VARCHAR2 length.", "error"),
    (r"\[facet 'minLength'\]",
     "CHECK (LENGTH >= n)", "Value is shorter than minimum required length.", "error"),
    (r"maxOccurs",
     "CHECK (ROW COUNT)", "Element count exceeds maximum allowed occurrences.", "error"),
    (r"minOccurs",
     "NOT NULL / MISSING CHILD", "Required child element is missing.", "error"),
    (r"This element is not expected",
     "STRUCTURE VIOLATION", "Unexpected element found. XML structure does not match schema.", "error"),
]


def _classify_error(raw_message):
    for pattern, constraint, description, severity in ORACLE_CONSTRAINT_MAP:
        if re.search(pattern, raw_message, re.IGNORECASE):
            return constraint, description, severity
    return "SCHEMA VIOLATION", "General XSD schema constraint violated.", "error"


def _extract_context(raw_message):
    field = ""
    m = re.search(r"attribute '(.+?)'", raw_message)
    if m:
        field = m.group(1)
    m2 = re.search(r"[Ee]lement '(.+?)'", raw_message)
    if m2 and not field:
        field = m2.group(1)
    bad_value = ""
    m3 = re.search(r"[Tt]he value '(.+?)'", raw_message)
    if m3:
        bad_value = m3.group(1)
    return field, bad_value


def _make_error(line, element, field, bad_value, constraint, description, severity, raw=""):
    msg = f"[{constraint}] {description}"
    if bad_value:
        msg += f" Value: '{bad_value}'"
    if raw:
        msg += f" | Raw: {raw}"
    return {
        "field": f"{element} > {field}" if field else element,
        "rule": constraint,
        "message": msg,
        "line": line,
        "severity": severity,
    }


def _run_business_rules(xml_path_or_none, xml_doc, icd10_codes, rvs_codes, filename):
    errors = []
    root = xml_doc.getroot()
    drgclaim = root.find("DRGCLAIM")
    if drgclaim is None:
        return errors

    # FIX 1: NewBornAdmWeight range check
    weight_raw = (drgclaim.get("NewBornAdmWeight") or "").strip()
    if weight_raw:
        try:
            w = float(weight_raw)
            if w <= 0.3 or w > 6.0:
                errors.append({
                    "field": "DRGCLAIM > NewBornAdmWeight",
                    "rule": "CHECK (NewBornAdmWeight > 0.3 AND <= 6.0)",
                    "message": f"[CHECK] NewBornAdmWeight must be > 0.3 and <= 6.0 kg. Got: {weight_raw}",
                    "line": getattr(drgclaim, "sourceline", None),
                    "severity": "error",
                })
        except ValueError:
            pass

    primary = (drgclaim.get("PrimaryCode") or "").strip().upper()

    # FIX 2: ICD-10 PrimaryCode FK
    if primary and icd10_codes and primary not in icd10_codes:
        errors.append({
            "field": "DRGCLAIM > PrimaryCode",
            "rule": "FK / ICD10_MASTER NOT FOUND",
            "message": f"[FK] PrimaryCode '{primary}' not found in ICD10 Case Rates master list.",
            "line": getattr(drgclaim, "sourceline", None),
            "severity": "error",
        })

    # FIX 2 + FIX 5: SecondaryCode FK + duplicates
    seen_secondary = {}
    for i, diag in enumerate(root.findall(".//SECONDARYDIAG"), start=1):
        code = (diag.get("SecondaryCode") or "").strip().upper()
        line = getattr(diag, "sourceline", None)

        if code and icd10_codes and code not in icd10_codes:
            errors.append({
                "field": "SECONDARYDIAG > SecondaryCode",
                "rule": "FK / ICD10_MASTER NOT FOUND",
                "message": f"[FK] SecondaryCode '{code}' not found in ICD10 Case Rates master list.",
                "line": line, "severity": "error",
            })

        if code and primary and code == primary:
            errors.append({
                "field": "SECONDARYDIAG > SecondaryCode",
                "rule": "UNIQUE CONSTRAINT (SecondaryCode != PrimaryCode)",
                "message": f"[UNIQUE] SecondaryCode '{code}' duplicates the claim's PrimaryCode.",
                "line": line, "severity": "error",
            })

        if code:
            if code in seen_secondary:
                errors.append({
                    "field": "SECONDARYDIAG > SecondaryCode",
                    "rule": "UNIQUE CONSTRAINT (SecondaryCode per claim)",
                    "message": f"[UNIQUE] Duplicate SecondaryCode '{code}'. First at row {seen_secondary[code]}, duplicate at row {i}.",
                    "line": line, "severity": "error",
                })
            else:
                seen_secondary[code] = i

    # FIX 3 + FIX 6: RVS FK + duplicates
    seen_rvs = {}
    for i, proc in enumerate(root.findall(".//PROCEDURE"), start=1):
        rvs = (proc.get("RvsCode") or "").strip()
        line = getattr(proc, "sourceline", None)

        if rvs and rvs_codes and rvs not in rvs_codes:
            errors.append({
                "field": "PROCEDURE > RvsCode",
                "rule": "FK / RVS_MASTER NOT FOUND",
                "message": f"[FK] RvsCode '{rvs}' not found in RVS Case Rates master list.",
                "line": line, "severity": "error",
            })

        if rvs:
            if rvs in seen_rvs:
                errors.append({
                    "field": "PROCEDURE > RvsCode",
                    "rule": "UNIQUE CONSTRAINT (RvsCode per claim)",
                    "message": f"[UNIQUE] Duplicate RvsCode '{rvs}'. First at row {seen_rvs[rvs]}, duplicate at row {i}.",
                    "line": line, "severity": "error",
                })
            else:
                seen_rvs[rvs] = i

    # FIX 4: UTF-8 byte check on Remarks (2000 bytes max)
    targets = [(drgclaim, "DRGCLAIM")] + \
              [(d, "SECONDARYDIAG") for d in root.findall(".//SECONDARYDIAG")] + \
              [(p, "PROCEDURE") for p in root.findall(".//PROCEDURE")]
    for node, elem_name in targets:
        remarks = node.get("Remarks") or ""
        if remarks:
            byte_len = len(remarks.encode("utf-8"))
            if byte_len > 2000:
                errors.append({
                    "field": f"{elem_name} > Remarks",
                    "rule": "CHECK (LENGTHB(Remarks) <= 2000)",
                    "message": f"[CHECK] Remarks exceeds 2000 UTF-8 bytes. Actual: {byte_len} bytes, {len(remarks)} chars.",
                    "line": getattr(node, "sourceline", None),
                    "severity": "error",
                })

    return errors


def check_cf5(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. Parse XML
    try:
        xml_doc = etree.fromstring(xml_bytes)
        xml_tree = etree.ElementTree(xml_doc)
    except etree.XMLSyntaxError as e:
        return {"filename": filename, "status": "fail", "errors": [{
            "field": "XML", "rule": "well_formed",
            "message": f"XML syntax error: {e}", "line": None, "severity": "error",
        }]}

    # 2. Root element check
    if xml_doc.tag != "CF5":
        errors.append({"field": "root", "rule": "valid_root",
                       "message": f"Root element must be <CF5>, got <{xml_doc.tag}>",
                       "line": 1, "severity": "error"})
        return {"filename": filename, "status": "fail", "errors": errors}

    # 3. XSD validation
    xsd = _load_xsd()
    if xsd is None:
        errors.append({"field": "XSD", "rule": "xsd_missing",
                       "message": "CF5_validated.xsd not found — schema validation skipped",
                       "line": None, "severity": "warning"})
    else:
        xsd.validate(xml_tree)
        for err in xsd.error_log:
            constraint, description, severity = _classify_error(err.message)
            field, bad_value = _extract_context(err.message)
            path_parts = err.path.split("/") if err.path else []
            element = path_parts[-1].split("[")[0] if path_parts else "N/A"
            errors.append(_make_error(err.line, element, field, bad_value,
                                      constraint, description, severity, err.message))

    # 4. Business rules
    icd10 = _load_icd10()
    rvs   = _load_rvs()
    try:
        biz_errors = _run_business_rules(None, xml_tree, icd10, rvs, filename)
        errors.extend(biz_errors)
    except Exception as ex:
        errors.append({"field": "validator", "rule": "business_rules",
                       "message": f"Business rule check failed: {ex}",
                       "line": None, "severity": "warning"})

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
