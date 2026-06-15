"""
CF4 (EPCB) XML Checker
Validates against EPCB.dtd and applies field-level rules using the medicine library.
"""
import os
import re
import json
import logging
import pandas as pd
from lxml import etree

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REFERENCES_DIR = os.path.join(BASE_DIR, "..", "references", "cf4")
EPCB_DTD_PATH = os.path.join(REFERENCES_DIR, "EPCB.dtd")
MED_LIB_PATH = os.path.join(REFERENCES_DIR, "lib_medicine.xlsx")

# Cache medicine library so it's only loaded once
_med_lib = None


def _load_med_lib():
    global _med_lib
    if _med_lib is None:
        try:
            df = pd.read_excel(
                MED_LIB_PATH,
                header=0,
                dtype={
                    "Drug Code": str,
                    "Drug Description": str,
                    "Gen Code": str,
                    "Salt Code": str,
                    "Form Code": str,
                    "Strength Code": str,
                    "Unit Code": str,
                    "Package Code": str,
                },
            )
            _med_lib = {str(row["Drug Code"]).strip(): row for _, row in df.iterrows()}
        except Exception as e:
            logging.warning(f"Could not load medicine library: {e}")
            _med_lib = {}
    return _med_lib


def _err(field, rule, message, line=None, severity="error"):
    return {"field": field, "rule": rule, "message": message, "line": line, "severity": severity}


def _get_line(xml_bytes, tag):
    """Approximate line number of an element or attribute mention."""
    try:
        lines = xml_bytes.splitlines()
        for i, line in enumerate(lines, 1):
            if tag.encode() in line:
                return i
    except Exception:
        pass
    return None


def _validate_date(value, fmt="MM-DD-YYYY"):
    """Return True if value matches the expected date format."""
    if fmt == "MM-DD-YYYY":
        return bool(re.fullmatch(r"\d{2}-\d{2}-\d{4}", value or ""))
    if fmt == "YYYY-MM-DD":
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""))
    return False


def _validate_time(value):
    """Return True if value matches HH:MM:SSAM/PM format."""
    return bool(re.fullmatch(r"\d{2}:\d{2}:\d{2}(AM|PM)", value or ""))


# ---------------------------------------------------------------------------
# Field-level validators per section
# ---------------------------------------------------------------------------

def _check_enlistment(elem, xml_bytes, errors):
    a = elem.attrib

    # Required attributes with length/format rules
    required = [
        ("pEClaimId", 50), ("pEClaimsTransmittalId", 50),
        ("pHciCaseNo", 50), ("pHciTransNo", 50),
        ("pEffYear", 4), ("pEnlistStat", 1),
        ("pMemPin", 12), ("pMemFname", 60), ("pMemMname", 60), ("pMemLname", 60),
        ("pPatientPin", 12), ("pPatientFname", 60), ("pPatientMname", 60), ("pPatientLname", 60),
        ("pCreatedBy", 50),
    ]
    for attr, max_len in required:
        val = a.get(attr, "")
        if not val:
            errors.append(_err(attr, "required", f"<ENLISTMENT> attribute '{attr}' is required"))
        elif len(val) > max_len:
            errors.append(_err(attr, "max_length",
                               f"<ENLISTMENT> '{attr}' exceeds max length {max_len}: got {len(val)}"))

    # Enum fields
    if a.get("pPackageType", "") not in ("P", "E", "A"):
        errors.append(_err("pPackageType", "enum",
                           f"pPackageType must be P, E, or A; got '{a.get('pPackageType')}'"))

    if a.get("pPatientSex", "") not in ("M", "F"):
        errors.append(_err("pPatientSex", "enum",
                           f"pPatientSex must be M or F; got '{a.get('pPatientSex')}'"))

    if a.get("pCivilStatus", "") not in ("S", "M", "W", "X", "A", "U"):
        errors.append(_err("pCivilStatus", "enum",
                           f"pCivilStatus must be S/M/W/X/A/U; got '{a.get('pCivilStatus')}'"))

    if a.get("pReportStatus", "") not in ("U", "V", "F"):
        errors.append(_err("pReportStatus", "enum",
                           f"pReportStatus must be U, V, or F; got '{a.get('pReportStatus')}'"))

    for yn_attr in ("pWithConsent", "pWithLoa", "pWithDisability", "pAvailFreeService"):
        if a.get(yn_attr, "") not in ("Y", "N", "X"):
            errors.append(_err(yn_attr, "enum",
                               f"{yn_attr} must be Y, N, or X; got '{a.get(yn_attr)}'"))

    if a.get("pDependentType", "") not in ("S", "C", "P", "X"):
        errors.append(_err("pDependentType", "enum",
                           f"pDependentType must be S/C/P/X; got '{a.get('pDependentType')}'"))

    # Date fields
    for date_attr in ("pEnlistDate", "pPatientDob", "pMemDob", "pTransDate"):
        val = a.get(date_attr, "")
        if val and not _validate_date(val):
            errors.append(_err(date_attr, "date_format",
                               f"{date_attr} must be MM-DD-YYYY; got '{val}'"))

    # Numeric year
    eff_year = a.get("pEffYear", "")
    if eff_year and not re.fullmatch(r"\d{4}", eff_year):
        errors.append(_err("pEffYear", "year_format",
                           f"pEffYear must be a 4-digit year; got '{eff_year}'"))


def _check_profile(elem, xml_bytes, errors):
    a = elem.attrib
    for attr in ("pHciTransNo", "pHciCaseNo", "pPatientPin", "pMemPin"):
        if not a.get(attr):
            errors.append(_err(attr, "required", f"<PROFILE> '{attr}' is required"))

    if a.get("pReportStatus", "") not in ("U", "V", "F"):
        errors.append(_err("pReportStatus", "enum",
                           f"<PROFILE> pReportStatus must be U/V/F; got '{a.get('pReportStatus')}'"))

    prof_date = a.get("pProfDate", "")
    if prof_date and not _validate_date(prof_date):
        errors.append(_err("pProfDate", "date_format",
                           f"pProfDate must be MM-DD-YYYY; got '{prof_date}'"))


def _check_soap(elem, xml_bytes, errors):
    a = elem.attrib
    for attr in ("pHciTransNo", "pHciCaseNo", "pPatientPin", "pMemPin"):
        if not a.get(attr):
            errors.append(_err(attr, "required", f"<SOAP> '{attr}' is required"))

    if a.get("pReportStatus", "") not in ("U", "V", "F"):
        errors.append(_err("pReportStatus", "enum",
                           f"<SOAP> pReportStatus must be U/V/F; got '{a.get('pReportStatus')}'"))


def _check_medicine(elem, xml_bytes, errors, med_lib):
    a = elem.attrib
    drug_code = a.get("pDrugCode", "").strip()

    if not drug_code:
        errors.append(_err("pDrugCode", "required", "<MEDICINE> pDrugCode is required"))
        return

    # Validate against medicine library
    if med_lib and drug_code not in med_lib:
        errors.append(_err("pDrugCode", "med_library",
                           f"Drug code '{drug_code}' not found in PHIC medicine library",
                           severity="error"))

    if a.get("pReportStatus", "") not in ("U", "V", "F"):
        errors.append(_err("pReportStatus", "enum",
                           f"<MEDICINE> pReportStatus must be U/V/F; got '{a.get('pReportStatus')}'"))

    # Numeric fields
    for num_attr in ("pDrugQty", "pDrugDays"):
        val = a.get(num_attr, "")
        if val:
            try:
                float(val)
            except ValueError:
                errors.append(_err(num_attr, "numeric",
                                   f"<MEDICINE> {num_attr} must be numeric; got '{val}'"))


def _check_courseward(elem, xml_bytes, errors):
    a = elem.attrib
    if not a.get("pHciTransNo"):
        errors.append(_err("pHciTransNo", "required", "<COURSEWARD> pHciTransNo is required"))
    if a.get("pReportStatus", "") not in ("U", "V", "F"):
        errors.append(_err("pReportStatus", "enum",
                           f"<COURSEWARD> pReportStatus must be U/V/F; got '{a.get('pReportStatus')}'"))


def _check_labresult(elem, xml_bytes, errors):
    a = elem.attrib
    for attr in ("pHciTransNo", "pHciCaseNo"):
        if not a.get(attr):
            errors.append(_err(attr, "required", f"<LABRESULT> '{attr}' is required"))


# ---------------------------------------------------------------------------
# Main checker
# ---------------------------------------------------------------------------

def check_cf4(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. DTD structural validation
    dtd_path = EPCB_DTD_PATH
    if os.path.exists(dtd_path):
        try:
            dtd = etree.DTD(file=dtd_path)
            tree = etree.fromstring(xml_bytes)
            if not dtd.validate(tree):
                for dtd_err in dtd.error_log:
                    errors.append(_err(
                        field="DTD",
                        rule="dtd_validation",
                        message=dtd_err.message,
                        line=dtd_err.line,
                        severity="error",
                    ))
        except etree.XMLSyntaxError as e:
            return {
                "filename": filename,
                "status": "fail",
                "errors": [_err("XML", "well_formed", f"XML syntax error: {e}", severity="error")],
            }
        except Exception as e:
            errors.append(_err("DTD", "dtd_load_error", f"Could not load DTD: {e}", severity="warning"))
    else:
        errors.append(_err("DTD", "dtd_missing",
                           "EPCB.dtd not found — structural validation skipped", severity="warning"))

    # 2. Parse XML for field-level validation
    try:
        tree = etree.fromstring(xml_bytes)
    except etree.XMLSyntaxError as e:
        return {
            "filename": filename,
            "status": "fail",
            "errors": [_err("XML", "well_formed", f"XML syntax error: {e}", severity="error")],
        }

    # Check root element
    if tree.tag != "EPCB":
        errors.append(_err("root", "valid_root",
                           f"Root element must be <EPCB>, got <{tree.tag}>",
                           line=1, severity="error"))

    # Required root-level attributes
    root_required = ["pUsername", "pPassword", "pHciAccreNo", "pEnlistTotalCnt",
                     "pProfileTotalCnt", "pSoapTotalCnt", "pEmrId",
                     "pCertificationId", "pHciTransmittalNumber"]
    for attr in root_required:
        if not tree.attrib.get(attr):
            errors.append(_err(attr, "required",
                               f"<EPCB> root attribute '{attr}' is required"))

    # Load medicine library
    med_lib = _load_med_lib()

    # 3. Field-level checks per section
    for enlistment in tree.findall(".//ENLISTMENT"):
        _check_enlistment(enlistment, xml_bytes, errors)

    for profile in tree.findall(".//PROFILE"):
        _check_profile(profile, xml_bytes, errors)

    for soap in tree.findall(".//SOAP"):
        _check_soap(soap, xml_bytes, errors)

    for medicine in tree.findall(".//MEDICINE"):
        _check_medicine(medicine, xml_bytes, errors, med_lib)

    for courseward in tree.findall(".//COURSEWARD"):
        _check_courseward(courseward, xml_bytes, errors)

    for labresult in tree.findall(".//LABRESULT"):
        _check_labresult(labresult, xml_bytes, errors)

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
