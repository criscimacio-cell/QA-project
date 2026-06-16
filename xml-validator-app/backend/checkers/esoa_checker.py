"""
eSOA XML Checker
Validates against ESOA.dtd, data dictionary rules, and eSOA Item Library.
"""
import os
import re
import openpyxl
from lxml import etree

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
REF_DIR       = os.path.join(BASE_DIR, "..", "references", "esoa")
DTD_PATH      = os.path.join(REF_DIR, "ESOA.dtd")
ITEM_LIB_PATH = os.path.join(REF_DIR, "Annex F - eSOA Item Library.xlsx")

_item_lib = None  # {str(code): {pItemCode, pCategory, pItemName}}


def _load_item_lib():
    global _item_lib
    if _item_lib is None:
        _item_lib = {}
        if os.path.exists(ITEM_LIB_PATH):
            wb = openpyxl.load_workbook(ITEM_LIB_PATH, read_only=True, data_only=True)
            ws = wb["ESOA_ITEM_LIB"]
            headers = None
            for row in ws.iter_rows(values_only=True):
                if headers is None:
                    headers = [str(c).strip() for c in row]
                    continue
                if any(c is not None for c in row):
                    rec = dict(zip(headers, row))
                    code = str(rec.get("pItemCode", "")).strip()
                    if code:
                        _item_lib[code] = rec
    return _item_lib


# ── Validators ────────────────────────────────────────────────────────────────

def _is_number(val, min_val=None, max_val=None):
    try:
        n = float(val)
        if min_val is not None and n < min_val:
            return False
        if max_val is not None and n > max_val:
            return False
        return True
    except (TypeError, ValueError):
        return False


def _is_integer(val, min_val=None, max_val=None):
    try:
        n = int(val)
        if min_val is not None and n < min_val:
            return False
        if max_val is not None and n > max_val:
            return False
        return True
    except (TypeError, ValueError):
        return False


def _is_date_mmddyyyy(val):
    return bool(re.match(r"^\d{2}-\d{2}-\d{4}$", str(val or "")))


def _err(field, rule, message, line=None):
    return {"field": field, "rule": rule, "message": message,
            "line": line, "severity": "error"}


# ── Main checker ──────────────────────────────────────────────────────────────

def check_esoa(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. DTD structural validation
    if os.path.exists(DTD_PATH):
        try:
            dtd  = etree.DTD(file=DTD_PATH)
            tree = etree.fromstring(xml_bytes)
            if not dtd.validate(tree):
                for e in dtd.error_log:
                    errors.append(_err("DTD", "dtd_structure", e.message, e.line))
        except etree.XMLSyntaxError as e:
            return {"filename": filename, "status": "fail", "errors": [
                _err("XML", "well_formed", f"XML syntax error: {e}")
            ]}
    else:
        errors.append({"field": "DTD", "rule": "dtd_missing",
                       "message": "ESOA.dtd not found — structural validation skipped",
                       "line": None, "severity": "warning"})
        try:
            tree = etree.fromstring(xml_bytes)
        except etree.XMLSyntaxError as e:
            return {"filename": filename, "status": "fail", "errors": [
                _err("XML", "well_formed", f"XML syntax error: {e}")
            ]}

    root = tree if not isinstance(tree, etree._Element) else tree
    if hasattr(tree, 'getroot'):
        root = tree.getroot()

    if root.tag != "eSOA":
        errors.append(_err("root", "valid_root", f"Root element must be <eSOA>, got <{root.tag}>", 1))
        return {"filename": filename, "status": "fail", "errors": errors}

    # 2. eSOA attributes
    pan = root.get("pHciPan", "")
    if not pan:
        errors.append(_err("eSOA > pHciPan", "NOT NULL", "[NOT NULL] pHciPan is required"))
    elif len(pan) > 9:
        errors.append(_err("eSOA > pHciPan", "VARCHAR2(9)", f"[LENGTH] pHciPan exceeds 9 characters: {len(pan)}"))

    transmittal = root.get("pHciTransmittalId", "")
    if not transmittal:
        errors.append(_err("eSOA > pHciTransmittalId", "NOT NULL", "[NOT NULL] pHciTransmittalId is required"))
    elif len(transmittal) > 50:
        errors.append(_err("eSOA > pHciTransmittalId", "VARCHAR2(50)", f"[LENGTH] pHciTransmittalId exceeds 50 characters: {len(transmittal)}"))

    # 3. SummaryOfFees — validate each SummaryOfFee child
    SUMMARY_SECTIONS = ["RoomAndBoard", "DrugsAndMedicine", "LaboratoryAndDiagnostic",
                        "OperatingRoomFees", "MedicalSupplies", "Others"]
    sof_parent = root.find("SummaryOfFees")
    if sof_parent is not None:
        for section_name in SUMMARY_SECTIONS:
            section = sof_parent.find(section_name)
            if section is None:
                continue
            sof = section.find("SummaryOfFee")
            if sof is None:
                continue
            path = f"SummaryOfFees > {section_name} > SummaryOfFee"
            for attr in ["pChargesNetOfApplicableVat", "pSeniorCitizenDiscount", "pPWDDiscount",
                         "pPCSO", "pDSWD", "pDOHMAP", "pHMO"]:
                val = sof.get(attr, "")
                if val == "":
                    errors.append(_err(f"{path} > {attr}", "NOT NULL", f"[NOT NULL] {attr} is required"))
                elif not _is_number(val, 0, 99999999.99):
                    errors.append(_err(f"{path} > {attr}", "NUMBER(10,2)",
                                       f"[NUMBER] {attr} must be a number between 0.00 and 99999999.99. Got: '{val}'"))

        # PhilHealth under SummaryOfFees
        ph = sof_parent.find("PhilHealth")
        if ph is not None:
            val = ph.get("pTotalCaseRateAmount", "")
            if not _is_number(val, 0, 999999.99):
                errors.append(_err("SummaryOfFees > PhilHealth > pTotalCaseRateAmount", "NUMBER(8,2)",
                                   f"[NUMBER] pTotalCaseRateAmount must be 0.00 to 999999.99. Got: '{val}'"))

        bal = sof_parent.find("Balance")
        if bal is not None:
            val = bal.get("pAmount", "")
            if not _is_number(val, 0, 99999999.99):
                errors.append(_err("SummaryOfFees > Balance > pAmount", "NUMBER(10,2)",
                                   f"[NUMBER] Balance pAmount must be 0.00 to 99999999.99. Got: '{val}'"))

    # 4. ProfessionalFees
    prof_fees = root.find("ProfessionalFees")
    if prof_fees is not None:
        for i, pf in enumerate(prof_fees.findall("ProfessionalFee"), start=1):
            info = pf.find("ProfessionalInfo")
            if info is not None:
                path = f"ProfessionalFees > ProfessionalFee[{i}] > ProfessionalInfo"
                pan_val = info.get("pPAN", "")
                if not pan_val:
                    errors.append(_err(f"{path} > pPAN", "NOT NULL", "[NOT NULL] pPAN is required"))
                elif len(pan_val) > 14:
                    errors.append(_err(f"{path} > pPAN", "VARCHAR2(14)", f"[LENGTH] pPAN exceeds 14 characters"))
                for name_attr, max_len in [("pFirstName", 60), ("pLastName", 60), ("pSuffixName", 60)]:
                    val = info.get(name_attr, "")
                    if not val:
                        errors.append(_err(f"{path} > {name_attr}", "NOT NULL", f"[NOT NULL] {name_attr} is required"))
                    elif len(val) > max_len:
                        errors.append(_err(f"{path} > {name_attr}", f"VARCHAR2({max_len})",
                                           f"[LENGTH] {name_attr} exceeds {max_len} characters"))

        ph = prof_fees.find("PhilHealth")
        if ph is not None:
            val = ph.get("pTotalCaseRateAmount", "")
            if not _is_number(val, 0, 999999.99):
                errors.append(_err("ProfessionalFees > PhilHealth > pTotalCaseRateAmount", "NUMBER(8,2)",
                                   f"[NUMBER] pTotalCaseRateAmount must be 0.00 to 999999.99. Got: '{val}'"))

    # 5. ItemizedBillingItems
    item_lib = _load_item_lib()
    items_parent = root.find("ItemizedBillingItems")
    if items_parent is not None:
        VALID_CATEGORIES = {"RoomAndBoard", "DrugsAndMedicine", "LaboratoryAndDiagnostic",
                            "OperatingRoomFees", "MedicalSupplies", "Others"}
        for i, item in enumerate(items_parent.findall("ItemizedBillingItem"), start=1):
            path = f"ItemizedBillingItems > ItemizedBillingItem[{i}]"
            line = getattr(item, "sourceline", None)

            svc_date = item.get("pServiceDate", "")
            if not svc_date:
                errors.append(_err(f"{path} > pServiceDate", "NOT NULL", "[NOT NULL] pServiceDate is required", line))
            elif not _is_date_mmddyyyy(svc_date):
                errors.append(_err(f"{path} > pServiceDate", "DATE(mm-dd-yyyy)",
                                   f"[DATE] pServiceDate must be mm-dd-yyyy. Got: '{svc_date}'", line))

            item_code = item.get("pItemCode", "")
            if len(item_code) > 30:
                errors.append(_err(f"{path} > pItemCode", "VARCHAR2(30)",
                                   f"[LENGTH] pItemCode exceeds 30 characters", line))
            if item_code and item_lib and item_code not in item_lib:
                errors.append(_err(f"{path} > pItemCode", "FK / ESOA_ITEM_LIB NOT FOUND",
                                   f"[FK] pItemCode '{item_code}' not found in eSOA Item Library", line))

            item_name = item.get("pItemName", "")
            if not item_name:
                errors.append(_err(f"{path} > pItemName", "NOT NULL", "[NOT NULL] pItemName is required", line))
            elif len(item_name) > 300:
                errors.append(_err(f"{path} > pItemName", "VARCHAR2(300)",
                                   f"[LENGTH] pItemName exceeds 300 characters", line))

            category = item.get("pCategory", "")
            if not category:
                errors.append(_err(f"{path} > pCategory", "NOT NULL", "[NOT NULL] pCategory is required", line))
            elif category not in VALID_CATEGORIES:
                errors.append(_err(f"{path} > pCategory", "CHECK (IN LIST)",
                                   f"[ENUM] pCategory must be one of {sorted(VALID_CATEGORIES)}. Got: '{category}'", line))

            uom = item.get("pUnitOfMeasurement", "")
            if len(uom) > 50:
                errors.append(_err(f"{path} > pUnitOfMeasurement", "VARCHAR2(50)",
                                   f"[LENGTH] pUnitOfMeasurement exceeds 50 characters", line))
            if category == "DrugsAndMedicine" and uom:
                errors.append(_err(f"{path} > pUnitOfMeasurement", "BLANK FOR DRUGS",
                                   f"[RULE] pUnitOfMeasurement must be blank for DrugsAndMedicine category", line))

            unit_price = item.get("pUnitPrice", "")
            if unit_price == "":
                errors.append(_err(f"{path} > pUnitPrice", "NOT NULL", "[NOT NULL] pUnitPrice is required", line))
            elif not _is_number(unit_price, 0, 999999.99):
                errors.append(_err(f"{path} > pUnitPrice", "NUMBER(8,2)",
                                   f"[NUMBER] pUnitPrice must be 0.00 to 999999.99. Got: '{unit_price}'", line))

            quantity = item.get("pQuantity", "")
            if quantity == "":
                errors.append(_err(f"{path} > pQuantity", "NOT NULL", "[NOT NULL] pQuantity is required", line))
            elif not _is_integer(quantity, 0, 9999):
                errors.append(_err(f"{path} > pQuantity", "NUMBER(4,0)",
                                   f"[NUMBER] pQuantity must be an integer 0 to 9999. Got: '{quantity}'", line))

            total_amt = item.get("pTotalAmount", "")
            if total_amt == "":
                errors.append(_err(f"{path} > pTotalAmount", "NOT NULL", "[NOT NULL] pTotalAmount is required", line))
            elif not _is_number(total_amt, 0, 999999999.99):
                errors.append(_err(f"{path} > pTotalAmount", "NUMBER(11,2)",
                                   f"[NUMBER] pTotalAmount must be 0.00 to 999999999.99. Got: '{total_amt}'", line))

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
