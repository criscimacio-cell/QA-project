"""
eSOA XML Checker
Ports esoa_xsd_validator.py exactly:
- XSD validation via ESOA_validated.xsd
- Item Library lookup via Annex F - eSOA Item Library.xlsx
- Medicine Library lookup via Annex F - Medicine Library.xlsx
- Business rules FIX 1-10
"""
import os
import re
from decimal import Decimal, InvalidOperation

import openpyxl
from lxml import etree

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
REF_DIR       = os.path.join(BASE_DIR, "..", "references", "esoa")
XSD_PATH      = os.path.join(REF_DIR, "ESOA_validated.xsd")
ITEM_LIB_PATH = os.path.join(REF_DIR, "Annex F - eSOA Item Library.xlsx")
MED_LIB_PATH  = os.path.join(REF_DIR, "Annex F - Medicine Library.xlsx")

CATEGORY_ELEMENTS = [
    "RoomAndBoard", "DrugsAndMedicine", "LaboratoryAndDiagnostic",
    "OperatingRoomFees", "MedicalSupplies", "Others",
]
AMOUNT_TOLERANCE = Decimal("0.01")

_xsd_schema    = None
_item_codes    = None  # set of str
_item_name_map = None  # {upper name: (code, category)}
_med_codes     = None  # set of str
_med_name_map  = None  # {upper name: [code, ...]}


def _load_xsd():
    global _xsd_schema
    if _xsd_schema is None and os.path.exists(XSD_PATH):
        _xsd_schema = etree.XMLSchema(etree.parse(XSD_PATH))
    return _xsd_schema


def _load_item_lib():
    global _item_codes, _item_name_map
    if _item_codes is None:
        _item_codes = set()
        _item_name_map = {}
        if os.path.exists(ITEM_LIB_PATH):
            wb = openpyxl.load_workbook(ITEM_LIB_PATH, read_only=True, data_only=True)
            ws = wb["ESOA_ITEM_LIB"]
            headers = None
            for row in ws.iter_rows(values_only=True):
                if headers is None:
                    headers = [str(c).strip() for c in row]
                    continue
                if not any(c is not None for c in row):
                    continue
                rec = dict(zip(headers, row))
                code = str(rec.get("pItemCode", "")).strip()
                cat  = str(rec.get("pCategory", "")).strip()
                name = str(rec.get("pItemName", "")).strip()
                if code:
                    _item_codes.add(code)
                if name:
                    _item_name_map[name.upper()] = (code, cat)
            wb.close()
    return _item_codes, _item_name_map


def _load_med_lib():
    global _med_codes, _med_name_map
    if _med_codes is None:
        _med_codes = set()
        _med_name_map = {}
        if os.path.exists(MED_LIB_PATH):
            wb = openpyxl.load_workbook(MED_LIB_PATH, read_only=True, data_only=True)
            ws = wb["lib_medicine"]
            headers = None
            for row in ws.iter_rows(values_only=True):
                if headers is None:
                    headers = [str(c).strip() for c in row]
                    continue
                if not any(c is not None for c in row):
                    continue
                rec = dict(zip(headers, row))
                code = str(rec.get("Drug Code", "")).strip()
                name = str(rec.get("Drug Description", "")).strip()
                if code:
                    _med_codes.add(code)
                if name:
                    _med_name_map.setdefault(name.upper(), []).append(code)
            wb.close()
    return _med_codes, _med_name_map


# ---------------------------------------------------------------------------
# Oracle-style constraint classifier
# ---------------------------------------------------------------------------
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


def _classify_error(raw):
    for pattern, constraint, description, severity in ORACLE_CONSTRAINT_MAP:
        if re.search(pattern, raw, re.IGNORECASE):
            return constraint, description, severity
    return "SCHEMA VIOLATION", "General XSD schema constraint violated.", "error"


def _extract_context(raw):
    field = ""
    m = re.search(r"attribute '(.+?)'", raw)
    if m:
        field = m.group(1)
    m2 = re.search(r"[Ee]lement '(.+?)'", raw)
    if m2 and not field:
        field = m2.group(1)
    bad_value = ""
    m3 = re.search(r"[Tt]he value '(.+?)'", raw)
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


def _to_decimal(value):
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Business rules (FIX 1-10 from reference script)
# ---------------------------------------------------------------------------
def _run_business_rules(xml_doc, item_codes, med_codes, item_name_map, med_name_map, filename):
    errors = []
    root = xml_doc.getroot()

    summary           = root.find("SummaryOfFees")
    professional_fees = root.find("ProfessionalFees")
    items_container   = root.find("ItemizedBillingItems")

    # Determine active categories (FIX 4)
    active_categories = set()
    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            if summary.find(cat_name) is not None:
                active_categories.add(cat_name)

    # FIX 9: OtherFundSource pDescription uniqueness across entire claim
    if summary is not None:
        seen_fund = {}
        for cat_name in CATEGORY_ELEMENTS:
            cat_el = summary.find(cat_name)
            if cat_el is None:
                continue
            for ofs in cat_el.findall("OtherFundSource"):
                desc = ofs.get("pDescription", "").strip()
                if not desc:
                    continue
                key = desc.upper()
                if key in seen_fund:
                    first_cat, first_line = seen_fund[key]
                    errors.append(_make_error(
                        getattr(ofs, "sourceline", None),
                        "OtherFundSource", "pDescription", desc,
                        "UNIQUE CONSTRAINT (pDescription across claim)",
                        f"OtherFundSource pDescription '{desc}' is duplicated. "
                        f"First under '{first_cat}' (line {first_line}), "
                        f"duplicate under '{cat_name}'.",
                        "error",
                        f"Duplicate OtherFundSource pDescription: {desc}"
                    ))
                else:
                    seen_fund[key] = (cat_name, getattr(ofs, "sourceline", None))

    # FIX 5: Discount fields must not exceed gross charge
    discount_fields = ["pSeniorCitizenDiscount", "pPWDDiscount", "pPCSO",
                       "pDSWD", "pDOHMAP", "pHMO"]

    def _check_sof_discounts(sof_node, context_label):
        if sof_node is None:
            return
        charges = _to_decimal(sof_node.get("pChargesNetOfApplicableVat", ""))
        if charges is None:
            return
        for f in discount_fields:
            disc = _to_decimal(sof_node.get(f, ""))
            if disc is None:
                continue
            if disc > charges:
                errors.append(_make_error(
                    getattr(sof_node, "sourceline", None),
                    "SummaryOfFee", f, str(disc),
                    "CHECK (discount <= pChargesNetOfApplicableVat)",
                    f"{f} ({disc}) in {context_label} exceeds "
                    f"pChargesNetOfApplicableVat ({charges}).",
                    "error",
                    f"{f}={disc} > pChargesNetOfApplicableVat={charges} in {context_label}"
                ))

    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            cat_el = summary.find(cat_name)
            if cat_el is not None:
                _check_sof_discounts(cat_el.find("SummaryOfFee"), cat_name)

    if professional_fees is not None:
        for i, pf in enumerate(professional_fees.findall("ProfessionalFee"), start=1):
            _check_sof_discounts(pf.find("SummaryOfFee"), f"ProfessionalFee[{i}]")

    # FIX 6: Balance arithmetic check
    def _check_balance(container_node, context_label):
        if container_node is None:
            return
        philhealth = container_node.find("PhilHealth")
        balance    = container_node.find("Balance")
        if philhealth is None or balance is None:
            return
        case_rate = _to_decimal(philhealth.get("pTotalCaseRateAmount", ""))
        bal_val   = _to_decimal(balance.get("pAmount", ""))
        if case_rate is None or bal_val is None:
            return

        total_charges   = Decimal("0.00")
        total_discounts = Decimal("0.00")
        total_other     = Decimal("0.00")
        parse_failed    = False
        sof_nodes       = []
        ofs_nodes       = []

        if context_label == "SummaryOfFees":
            for cat_name in CATEGORY_ELEMENTS:
                cat_el = container_node.find(cat_name)
                if cat_el is not None:
                    sof = cat_el.find("SummaryOfFee")
                    if sof is not None:
                        sof_nodes.append(sof)
                    ofs_nodes.extend(cat_el.findall("OtherFundSource"))
        else:
            for pf in container_node.findall("ProfessionalFee"):
                sof = pf.find("SummaryOfFee")
                if sof is not None:
                    sof_nodes.append(sof)

        for sof in sof_nodes:
            c = _to_decimal(sof.get("pChargesNetOfApplicableVat", ""))
            if c is None:
                parse_failed = True
                continue
            total_charges += c
            for f in discount_fields:
                d = _to_decimal(sof.get(f, ""))
                if d is None:
                    parse_failed = True
                    continue
                total_discounts += d

        for ofs in ofs_nodes:
            o = _to_decimal(ofs.get("pAmount", ""))
            if o is None:
                parse_failed = True
                continue
            total_other += o

        if parse_failed:
            return

        expected = total_charges - total_discounts - total_other - case_rate
        if abs(bal_val - expected) > AMOUNT_TOLERANCE:
            errors.append(_make_error(
                getattr(balance, "sourceline", None),
                "Balance", "pAmount", str(bal_val),
                "CHECK (Balance = Charges - Discounts - OtherFundSource - CaseRate)",
                f"{context_label} Balance ({bal_val}) != computed "
                f"({expected:.2f}) = Charges({total_charges:.2f}) - "
                f"Discounts({total_discounts:.2f}) - OtherFunds({total_other:.2f}) "
                f"- CaseRate({case_rate:.2f}).",
                "error",
                f"Balance mismatch in {context_label}: declared={bal_val}, expected={expected:.2f}"
            ))

    _check_balance(summary, "SummaryOfFees")
    _check_balance(professional_fees, "ProfessionalFees")

    # ItemizedBillingItem checks
    category_item_totals      = {cat: Decimal("0.00") for cat in CATEGORY_ELEMENTS}
    category_totals_parse_failed = set()

    if items_container is not None:
        for i, item in enumerate(items_container.findall("ItemizedBillingItem"), start=1):
            code       = item.get("pItemCode", "").strip()
            category   = item.get("pCategory", "").strip()
            unit       = item.get("pUnitOfMeasurement", "").strip()
            unit_price = _to_decimal(item.get("pUnitPrice", ""))
            qty_raw    = item.get("pQuantity", "").strip()
            total_amt  = _to_decimal(item.get("pTotalAmount", ""))
            line       = getattr(item, "sourceline", None)

            if category in category_item_totals:
                if total_amt is not None:
                    category_item_totals[category] += total_amt
                else:
                    category_totals_parse_failed.add(category)

            # FIX 1: pItemCode FK lookup routed by category
            if code:
                if category == "DrugsAndMedicine":
                    if med_codes and code not in med_codes:
                        errors.append(_make_error(
                            line, "ItemizedBillingItem", "pItemCode", code,
                            "FK / LIB_MEDICINE NOT FOUND",
                            f"pItemCode '{code}' not found in Medicine Library. "
                            f"For DrugsAndMedicine, pItemCode must be a valid Drug Code "
                            f"or left blank if not listed.",
                            "error",
                            f"Medicine Library lookup failed: {code}"
                        ))
                else:
                    if item_codes and code not in item_codes:
                        errors.append(_make_error(
                            line, "ItemizedBillingItem", "pItemCode", code,
                            "FK / ITEM_LIB NOT FOUND",
                            f"pItemCode '{code}' not found in eSOA Item Library. "
                            f"Must be a valid listed code for category '{category}' "
                            f"or left blank if not in the library.",
                            "error",
                            f"Item Library lookup failed: {code}"
                        ))

            # FIX 1b: pItemName -> Library cross-check
            name_key   = item.get("pItemName", "").strip().upper()
            item_match = item_name_map.get(name_key) if item_name_map else None
            med_match  = med_name_map.get(name_key) if med_name_map else None

            if item_match is not None:
                exp_code, exp_cat = item_match
                if not code:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pItemCode", "(blank)",
                        "CHECK (pItemCode REQUIRED WHEN pItemName IN LIBRARY)",
                        f"pItemName matches Item Library entry (code '{exp_code}', "
                        f"category '{exp_cat}'). pItemCode must not be blank.",
                        "error",
                        f"Blank pItemCode for library-listed item: {name_key}"
                    ))
                elif code != exp_code:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pItemCode", code,
                        "CHECK (pItemCode MATCHES LIBRARY FOR pItemName)",
                        f"pItemName matches Item Library code '{exp_code}', "
                        f"but pItemCode is '{code}'.",
                        "error",
                        f"pItemCode/pItemName mismatch: got {code}, expected {exp_code}"
                    ))
                if category and category != exp_cat:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pCategory", category,
                        "CHECK (pCategory MATCHES LIBRARY FOR pItemName)",
                        f"pItemName is listed under category '{exp_cat}' in Item Library, "
                        f"but pCategory is '{category}'.",
                        "error",
                        f"pCategory mismatch: got {category}, expected {exp_cat}"
                    ))
            elif med_match is not None:
                if not code:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pItemCode", "(blank)",
                        "CHECK (pItemCode REQUIRED WHEN pItemName IN MEDICINE LIBRARY)",
                        f"pItemName matches Medicine Library (code(s): {', '.join(med_match)}). "
                        f"pItemCode must not be blank.",
                        "error",
                        f"Blank pItemCode for library-listed drug: {name_key}"
                    ))
                elif code not in med_match:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pItemCode", code,
                        "CHECK (pItemCode MATCHES MEDICINE LIBRARY FOR pItemName)",
                        f"pItemName matches Medicine Library code(s) "
                        f"{', '.join(med_match)}, but pItemCode is '{code}'.",
                        "error",
                        f"pItemCode/pItemName mismatch: got {code}, expected one of {med_match}"
                    ))
                if category and category != "DrugsAndMedicine":
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pCategory", category,
                        "CHECK (pCategory='DrugsAndMedicine' FOR MEDICINE LIBRARY ITEM)",
                        f"pItemName is in Medicine Library so pCategory must be "
                        f"'DrugsAndMedicine', not '{category}'.",
                        "error",
                        f"pCategory mismatch for medicine item: {category}"
                    ))

            # FIX 2: pUnitOfMeasurement must be blank for DrugsAndMedicine
            if category == "DrugsAndMedicine" and unit:
                errors.append(_make_error(
                    line, "ItemizedBillingItem", "pUnitOfMeasurement", unit,
                    "CHECK (pUnitOfMeasurement IS BLANK WHEN pCategory='DrugsAndMedicine')",
                    f"pUnitOfMeasurement must be blank for DrugsAndMedicine. Got: '{unit}'.",
                    "error",
                    f"Non-blank pUnitOfMeasurement for DrugsAndMedicine: {unit}"
                ))

            # FIX 3: pTotalAmount = pUnitPrice x pQuantity
            if unit_price is not None and qty_raw.isdigit() and total_amt is not None:
                expected_total = unit_price * Decimal(qty_raw)
                if abs(total_amt - expected_total) > AMOUNT_TOLERANCE:
                    errors.append(_make_error(
                        line, "ItemizedBillingItem", "pTotalAmount", str(total_amt),
                        "CHECK (pTotalAmount = pUnitPrice * pQuantity)",
                        f"pTotalAmount ({total_amt}) != pUnitPrice ({unit_price}) x "
                        f"pQuantity ({qty_raw}) = {expected_total}.",
                        "error",
                        f"Amount mismatch: declared={total_amt}, expected={expected_total}"
                    ))

            # FIX 4: pCategory must exist in SummaryOfFees
            if category and active_categories and category not in active_categories:
                errors.append(_make_error(
                    line, "ItemizedBillingItem", "pCategory", category,
                    "CHECK (pCategory EXISTS IN SummaryOfFees)",
                    f"pCategory '{category}' on item #{i} does not correspond "
                    f"to any category block in SummaryOfFees.",
                    "error",
                    f"pCategory '{category}' not found in SummaryOfFees categories"
                ))

    # FIX 10: Items-vs-Summary reconciliation per category
    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            if cat_name in category_totals_parse_failed:
                continue
            cat_el = summary.find(cat_name)
            if cat_el is None:
                continue
            sof = cat_el.find("SummaryOfFee")
            if sof is None:
                continue
            declared = _to_decimal(sof.get("pChargesNetOfApplicableVat", ""))
            if declared is None:
                continue
            items_total = category_item_totals[cat_name]
            if abs(items_total - declared) > AMOUNT_TOLERANCE:
                errors.append(_make_error(
                    getattr(sof, "sourceline", None),
                    "SummaryOfFee", "pChargesNetOfApplicableVat", str(declared),
                    "CHECK (SUM(ItemizedBillingItem.pTotalAmount) = pChargesNetOfApplicableVat)",
                    f"For category '{cat_name}', sum of ItemizedBillingItem pTotalAmount "
                    f"({items_total:.2f}) != declared pChargesNetOfApplicableVat "
                    f"({declared:.2f}).",
                    "error",
                    f"Items total ({items_total:.2f}) != Summary charge ({declared:.2f}) "
                    f"for category {cat_name}"
                ))

    return errors


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def check_esoa(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. Parse XML
    try:
        xml_doc  = etree.fromstring(xml_bytes)
        xml_tree = etree.ElementTree(xml_doc)
    except etree.XMLSyntaxError as e:
        return {"filename": filename, "status": "fail", "errors": [{
            "field": "XML", "rule": "well_formed",
            "message": f"XML syntax error: {e}", "line": None, "severity": "error",
        }]}

    # 2. Root check
    if xml_doc.tag != "eSOA":
        return {"filename": filename, "status": "fail", "errors": [{
            "field": "root", "rule": "valid_root",
            "message": f"Root element must be <eSOA>, got <{xml_doc.tag}>",
            "line": 1, "severity": "error",
        }]}

    # 3. XSD validation
    xsd = _load_xsd()
    if xsd is None:
        errors.append({"field": "XSD", "rule": "xsd_missing",
                       "message": "ESOA_validated.xsd not found — schema validation skipped",
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
    item_codes, item_name_map = _load_item_lib()
    med_codes, med_name_map   = _load_med_lib()
    try:
        biz_errors = _run_business_rules(xml_tree, item_codes, med_codes,
                                          item_name_map, med_name_map, filename)
        errors.extend(biz_errors)
    except Exception as ex:
        errors.append({"field": "validator", "rule": "business_rules",
                       "message": f"Business rule check failed: {ex}",
                       "line": None, "severity": "warning"})

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
