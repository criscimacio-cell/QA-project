#!/usr/bin/env python3
"""
=============================================================================
eSOA XSD Validator - Oracle-Style Validation Report  v1.0
=============================================================================
Schema   : ESOA_validated.xsd (Annex F enriched)
Output   : Console report + Excel (3 sheets)

Fixes implemented (post-XSD Python business rules):
  FIX 1  - pItemCode required-but-blankable; routed by category per
           Annex F: DrugsAndMedicine -> Medicine Library lookup,
           all other categories -> eSOA Item Library lookup
  FIX 1b - pItemName -> Library cross-check: if pItemName matches a
           library entry, pItemCode/pCategory must reflect that entry
           (not blank, not freely chosen); if no library match, blank
           code and any category is acceptable
  FIX 2  - pUnitOfMeasurement required-but-blankable; must be blank when
           pCategory = "DrugsAndMedicine" (Annex F business rule)
  FIX 3  - pTotalAmount must equal pUnitPrice x pQuantity (arithmetic check)
  FIX 4  - pCategory cross-check: every ItemizedBillingItem category must
           correspond to one of the 6 SummaryOfFees categories actually
           present in the claim
  FIX 5  - SummaryOfFee discount fields (SeniorCitizen/PWD/PCSO/DSWD/
           DOHMAP/HMO) must not individually exceed pChargesNetOfApplicableVat
  FIX 6  - Balance arithmetic check per SummaryOfFees/ProfessionalFees
           block: Balance = Charges - Discounts - OtherFundSource
           - PhilHealth CaseRate (tolerance 0.01)
  FIX 7  - pHciTransmittalId uniqueness across batch (UNIQUE constraint)
  FIX 8  - Recursive folder support (--recursive flag)
  FIX 9  - OtherFundSource pDescription must be unique across the
           entire claim (all categories combined, not per-category)
  FIX 10 - Items-vs-Summary reconciliation: sum of ItemizedBillingItem
           pTotalAmount per category must match that category's
           SummaryOfFee.pChargesNetOfApplicableVat (tolerance 0.01)
  BUSINESS RULE - Balance.pAmount allowed to be negative (only field
           in the schema with this exception)
  BONUS  - Raw lxml error included in Excel VIOLATION DETAILS sheet

Oracle Constraint Equivalents:
  NOT NULL        -> use="required"
  VARCHAR2(n)     -> xs:maxLength
  CHECK (REGEXP)  -> xs:pattern
  CHECK (IN list) -> xs:enumeration
  NUMBER(p,s)     -> xs:pattern + numeric range/arithmetic check (Python)
  UNIQUE          -> cross-file pHciTransmittalId check (FIX 7)
  FK / MASTER     -> CSV lookup for Item Library and Medicine Library (FIX 1)
=============================================================================
Usage:
  python esoa_xsd_validator.py --xml claim.xml --xsd ESOA_validated.xsd
                                --items ESOA_Item_Library.csv
                                --meds  ESOA_Medicine_Library.csv

  python esoa_xsd_validator.py --xml ./batch/ --xsd ESOA_validated.xsd
                                --items ESOA_Item_Library.csv
                                --meds  ESOA_Medicine_Library.csv
                                --recursive --out report.xlsx
=============================================================================
"""

import argparse
import os
import re
import sys
import textwrap
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

import pandas as pd
from lxml import etree
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter


# ---------------------------------------------------------------------------
# Oracle-style constraint map
# (regex on lxml message, oracle_constraint, description, severity)
# ---------------------------------------------------------------------------
ORACLE_CONSTRAINT_MAP = [
    (r"missing required attribute '(.+?)'",
     "NOT NULL",
     "Attribute is #REQUIRED (NOT NULL). Value must be provided.",
     "CRITICAL"),

    (r"The value '.+?' is not an element of the set \{(.+?)\}",
     "CHECK (IN LIST)",
     "Value violates enumeration constraint. Must be one of the allowed values.",
     "HIGH"),

    (r"\[facet 'pattern'\]",
     "CHECK (REGEXP_LIKE)",
     "Value does not match required format/pattern (regex constraint).",
     "HIGH"),

    (r"\[facet 'maxLength'\]",
     "CHECK (LENGTH <= n)",
     "Value exceeds maximum allowed VARCHAR2 length.",
     "HIGH"),

    (r"\[facet 'minLength'\]",
     "CHECK (LENGTH >= n)",
     "Value is shorter than minimum required length.",
     "HIGH"),

    (r"maxOccurs",
     "CHECK (ROW COUNT)",
     "Element count exceeds maximum allowed occurrences.",
     "HIGH"),

    (r"minOccurs",
     "NOT NULL / MISSING CHILD",
     "Required child element is missing.",
     "CRITICAL"),

    (r"This element is not expected",
     "STRUCTURE VIOLATION",
     "Unexpected element found. XML structure does not match schema.",
     "HIGH"),
]

SEVERITY_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}

CATEGORY_ELEMENTS = [
    "RoomAndBoard", "DrugsAndMedicine", "LaboratoryAndDiagnostic",
    "OperatingRoomFees", "MedicalSupplies", "Others",
]

# Tolerance for floating point / centavo rounding differences in amount math
AMOUNT_TOLERANCE = Decimal("0.01")


# ---------------------------------------------------------------------------
# Load reference master lists
# ---------------------------------------------------------------------------
def load_item_library(csv_path: str):
    """
    Load the eSOA Item Library CSV.
    Expected columns: pItemCode, pCategory, pItemName
    Returns:
      item_codes: set of valid pItemCode values (FK lookup)
      item_name_map: dict {normalized pItemName: (pItemCode, pCategory)}
        Item Library names are unique (no duplicate pItemName rows), so
        each name maps to exactly one code/category pair.
    Oracle equiv: FK reference to ESOA_ITEM_LIB table
    """
    df = pd.read_csv(csv_path, dtype=str)
    code_col = "pItemCode" if "pItemCode" in df.columns else df.columns[0]
    cat_col = "pCategory" if "pCategory" in df.columns else df.columns[1]
    name_col = "pItemName" if "pItemName" in df.columns else df.columns[2]

    df = df.dropna(subset=[code_col, name_col])
    item_codes = set(df[code_col].str.strip())

    item_name_map = {}
    for _, row in df.iterrows():
        name_key = row[name_col].strip().upper()
        item_name_map[name_key] = (row[code_col].strip(), row[cat_col].strip())

    return item_codes, item_name_map


def load_medicine_library(csv_path: str):
    """
    Load the Medicine Library CSV.
    Expected columns: DrugCode, DrugDescription (or similar)
    Returns:
      med_codes: set of valid drug codes (FK lookup)
      med_name_map: dict {normalized DrugDescription: [code1, code2, ...]}
        Medicine Library descriptions are NOT all unique (the same drug
        can appear under multiple packaging/container codes), so each
        name maps to a list of one or more valid codes.
    Oracle equiv: FK reference to LIB_MEDICINE table
    """
    df = pd.read_csv(csv_path, dtype=str)
    code_col = "DrugCode" if "DrugCode" in df.columns else df.columns[0]
    name_col = "DrugDescription" if "DrugDescription" in df.columns else df.columns[1]

    df = df.dropna(subset=[code_col, name_col])
    med_codes = set(df[code_col].str.strip())

    med_name_map = {}
    for _, row in df.iterrows():
        name_key = row[name_col].strip().upper()
        med_name_map.setdefault(name_key, []).append(row[code_col].strip())

    return med_codes, med_name_map


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def classify_error(raw_message: str):
    for pattern, constraint, description, severity in ORACLE_CONSTRAINT_MAP:
        if re.search(pattern, raw_message, re.IGNORECASE):
            return constraint, description, severity
    return "SCHEMA VIOLATION", "General XSD schema constraint violated.", "HIGH"


def extract_context(raw_message: str):
    field = "N/A"
    bad_value = "N/A"
    m = re.search(r"attribute '(.+?)'", raw_message)
    if m:
        field = m.group(1)
    m2 = re.search(r"[Ee]lement '(.+?)'", raw_message)
    if m2 and field == "N/A":
        field = m2.group(1)
    m3 = re.search(r"[Tt]he value '(.+?)'", raw_message)
    if m3:
        bad_value = m3.group(1)
    return field, bad_value


def to_decimal(value: str):
    """Safely parse a numeric string to Decimal. Returns None on failure."""
    try:
        return Decimal(value.strip())
    except (InvalidOperation, AttributeError, ValueError):
        return None


def make_error(file, line, element, field, bad_value, constraint, description, severity, raw=""):
    return {
        "file": file,
        "line": line,
        "element": element,
        "field": field,
        "bad_value": str(bad_value),
        "oracle_constraint": constraint,
        "description": description,
        "severity": severity,
        "raw_error": raw,
    }


# ---------------------------------------------------------------------------
# POST-XSD BUSINESS RULE CHECKS
# ---------------------------------------------------------------------------
def run_business_rules(xml_path: Path, xml_doc, item_codes: set, med_codes: set,
                        item_name_map: dict = None, med_name_map: dict = None) -> list:
    """
    Run all post-XSD business rule checks that XSD cannot enforce.
    Returns list of error dicts.
    """
    errors = []
    fname = xml_path.name
    root = xml_doc.getroot()
    item_name_map = item_name_map or {}
    med_name_map = med_name_map or {}

    summary = root.find("SummaryOfFees")
    professional_fees = root.find("ProfessionalFees")
    items_container = root.find("ItemizedBillingItems")

    # ------------------------------------------------------------------
    # Determine which of the 6 categories actually have non-zero charges
    # in SummaryOfFees, for FIX 4 cross-check
    # ------------------------------------------------------------------
    active_categories = set()
    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            cat_el = summary.find(cat_name)
            if cat_el is None:
                continue
            sof = cat_el.find("SummaryOfFee")
            if sof is None:
                continue
            charges = to_decimal(sof.get("pChargesNetOfApplicableVat", ""))
            # Category counts as "active" if it exists in the claim at all;
            # items can legitimately be billed under a category even if the
            # displayed charge total is 0.00 in edge cases, so we treat
            # presence of the category element as sufficient, not just a
            # non-zero charge.
            active_categories.add(cat_name)

    # ------------------------------------------------------------------
    # FIX 9: OtherFundSource pDescription must not repeat anywhere in
    # the claim (checked across ALL categories combined, not per-category)
    # Oracle: CHECK (UNIQUE pDescription across all OtherFundSource rows
    #                for a given ClaimNumber/pHciTransmittalId)
    # ------------------------------------------------------------------
    if summary is not None:
        seen_fund_sources = {}  # {normalized description: (category, sourceline)}
        for cat_name in CATEGORY_ELEMENTS:
            cat_el = summary.find(cat_name)
            if cat_el is None:
                continue
            for ofs in cat_el.findall("OtherFundSource"):
                desc_raw = ofs.get("pDescription", "").strip()
                if not desc_raw:
                    continue
                desc_key = desc_raw.upper()
                if desc_key in seen_fund_sources:
                    first_category, first_line = seen_fund_sources[desc_key]
                    errors.append(make_error(
                        fname, ofs.sourceline, "OtherFundSource", "pDescription",
                        desc_raw,
                        "UNIQUE CONSTRAINT (pDescription across claim)",
                        f"OtherFundSource pDescription '{desc_raw}' is duplicated. "
                        f"First occurrence under category '{first_category}' "
                        f"(line {first_line}), duplicate under '{cat_name}' "
                        f"(line {ofs.sourceline}). A funding source name must "
                        f"appear only once per claim, across all categories.",
                        "HIGH",
                        f"Duplicate OtherFundSource pDescription: {desc_raw}"
                    ))
                else:
                    seen_fund_sources[desc_key] = (cat_name, ofs.sourceline)

    # ------------------------------------------------------------------
    # FIX 5: SummaryOfFee discount fields must not exceed the gross charge
    # Oracle: CHECK (discount_field <= pChargesNetOfApplicableVat)
    # ------------------------------------------------------------------
    discount_fields = ["pSeniorCitizenDiscount", "pPWDDiscount", "pPCSO",
                        "pDSWD", "pDOHMAP", "pHMO"]

    def check_summary_of_fee(sof_node, context_label):
        if sof_node is None:
            return
        charges = to_decimal(sof_node.get("pChargesNetOfApplicableVat", ""))
        if charges is None:
            return
        for field in discount_fields:
            disc = to_decimal(sof_node.get(field, ""))
            if disc is None:
                continue
            if disc > charges:
                errors.append(make_error(
                    fname, sof_node.sourceline, "SummaryOfFee", field,
                    str(disc),
                    "CHECK (discount <= pChargesNetOfApplicableVat)",
                    f"{field} ({disc}) in {context_label} exceeds "
                    f"pChargesNetOfApplicableVat ({charges}). A discount "
                    f"cannot be larger than the gross charge it applies to.",
                    "HIGH",
                    f"{field}={disc} > pChargesNetOfApplicableVat={charges} in {context_label}"
                ))

    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            cat_el = summary.find(cat_name)
            if cat_el is not None:
                check_summary_of_fee(cat_el.find("SummaryOfFee"), cat_name)

    if professional_fees is not None:
        for i, pf in enumerate(professional_fees.findall("ProfessionalFee"), start=1):
            check_summary_of_fee(pf.find("SummaryOfFee"), f"ProfessionalFee[{i}]")

    # ------------------------------------------------------------------
    # FIX 6: Balance = Charges - Discounts - OtherFundSource - PhilHealth,
    # within tolerance. OtherFundSource pAmount is documented in Annex F
    # as "the amount of other funding source DISCOUNT, if applicable" -
    # i.e. it is an additional offset against the balance, same as the
    # 6 SummaryOfFee discount fields, just declared separately per
    # category rather than as a fixed attribute.
    # Applies to both SummaryOfFees and ProfessionalFees top-level blocks
    # (these have a single combined PhilHealth + Balance, not per-category).
    # ProfessionalFees has no OtherFundSource siblings in the schema, so
    # that term is simply 0 for that context.
    # Oracle: CHECK (ABS(Balance - (TotalCharges - TotalDiscounts
    #                - TotalOtherFundSource - CaseRate)) <= 0.01)
    # ------------------------------------------------------------------
    def check_balance(container_node, context_label):
        if container_node is None:
            return
        philhealth = container_node.find("PhilHealth")
        balance = container_node.find("Balance")
        if philhealth is None or balance is None:
            return
        case_rate = to_decimal(philhealth.get("pTotalCaseRateAmount", ""))
        bal_val = to_decimal(balance.get("pAmount", ""))
        if case_rate is None or bal_val is None:
            return

        # Sum up total charges, total discounts, and total OtherFundSource
        # amounts across whatever SummaryOfFee/OtherFundSource nodes exist
        # directly under this container (category sub-elements for
        # SummaryOfFees, ProfessionalFee* for ProfessionalFees).
        total_charges = Decimal("0.00")
        total_discounts = Decimal("0.00")
        total_other_funds = Decimal("0.00")
        sof_nodes = []
        ofs_nodes = []

        if context_label == "SummaryOfFees":
            for cat_name in CATEGORY_ELEMENTS:
                cat_el = container_node.find(cat_name)
                if cat_el is not None:
                    sof = cat_el.find("SummaryOfFee")
                    if sof is not None:
                        sof_nodes.append(sof)
                    ofs_nodes.extend(cat_el.findall("OtherFundSource"))
        else:  # ProfessionalFees - no OtherFundSource siblings in schema
            for pf in container_node.findall("ProfessionalFee"):
                sof = pf.find("SummaryOfFee")
                if sof is not None:
                    sof_nodes.append(sof)

        parse_failed = False
        for sof in sof_nodes:
            c = to_decimal(sof.get("pChargesNetOfApplicableVat", ""))
            if c is None:
                parse_failed = True
                continue
            total_charges += c
            for field in discount_fields:
                d = to_decimal(sof.get(field, ""))
                if d is None:
                    parse_failed = True
                    continue
                total_discounts += d

        for ofs in ofs_nodes:
            o = to_decimal(ofs.get("pAmount", ""))
            if o is None:
                parse_failed = True
                continue
            total_other_funds += o

        if parse_failed:
            return  # already caught by XSD pattern errors

        expected_balance = total_charges - total_discounts - total_other_funds - case_rate
        if abs(bal_val - expected_balance) > AMOUNT_TOLERANCE:
            errors.append(make_error(
                fname, balance.sourceline, "Balance", "pAmount",
                str(bal_val),
                "CHECK (Balance = Charges - Discounts - OtherFundSource - CaseRate)",
                f"{context_label} Balance ({bal_val}) does not match "
                f"computed value ({expected_balance:.2f}) = "
                f"Charges ({total_charges:.2f}) - Discounts ({total_discounts:.2f}) "
                f"- OtherFundSource ({total_other_funds:.2f}) "
                f"- PhilHealth CaseRate ({case_rate:.2f}).",
                "HIGH",
                f"Balance mismatch in {context_label}: declared={bal_val}, expected={expected_balance:.2f}"
            ))

    check_balance(summary, "SummaryOfFees")
    check_balance(professional_fees, "ProfessionalFees")

    # ------------------------------------------------------------------
    # ItemizedBillingItem-level checks
    # ------------------------------------------------------------------
    category_item_totals = {cat: Decimal("0.00") for cat in CATEGORY_ELEMENTS}
    category_totals_parse_failed = set()

    if items_container is not None:
        for i, item in enumerate(items_container.findall("ItemizedBillingItem"), start=1):
            code = item.get("pItemCode", "").strip()
            category = item.get("pCategory", "").strip()
            unit = item.get("pUnitOfMeasurement", "").strip()
            unit_price = to_decimal(item.get("pUnitPrice", ""))
            quantity_raw = item.get("pQuantity", "").strip()
            total_amount = to_decimal(item.get("pTotalAmount", ""))

            # Accumulate per-category item totals for FIX 10 reconciliation
            if category in category_item_totals:
                if total_amount is not None:
                    category_item_totals[category] += total_amount
                else:
                    category_totals_parse_failed.add(category)

            # --------------------------------------------------------
            # FIX 1: pItemCode FK lookup, routed by category per Annex F:
            #   - DrugsAndMedicine -> must match the Medicine Library
            #   - all other categories -> must match the eSOA Item Library
            # Blank pItemCode is valid (item not in the applicable library)
            # --------------------------------------------------------
            if code:
                if category == "DrugsAndMedicine":
                    if med_codes and code not in med_codes:
                        errors.append(make_error(
                            fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                            code,
                            "FK / LIB_MEDICINE NOT FOUND",
                            f"pItemCode '{code}' not found in the Medicine Library. "
                            f"For pCategory='DrugsAndMedicine', pItemCode must be a "
                            f"valid Drug Code (30 chars) from the Medicine Library, "
                            f"or left blank if the drug is not listed.",
                            "HIGH",
                            f"Medicine Library lookup failed for: {code}"
                        ))
                else:
                    if item_codes and code not in item_codes:
                        errors.append(make_error(
                            fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                            code,
                            "FK / ITEM_LIB NOT FOUND",
                            f"pItemCode '{code}' not found in the eSOA Item Library. "
                            f"Must be a valid listed code for category '{category}', "
                            f"or left blank if the item is not in the library.",
                            "HIGH",
                            f"Item Library lookup failed for: {code}"
                        ))

            # --------------------------------------------------------
            # FIX 1b: pItemName -> Library cross-check.
            # If pItemName exactly matches a library entry, pItemCode
            # (and pCategory, for Item Library matches) must reflect
            # that library entry - it should NOT be left blank or set
            # to a different category. If pItemName has no library
            # match at all, pItemCode should be blank (covered by the
            # FK check above) and any of the 6 categories is acceptable.
            # --------------------------------------------------------
            name_key = item.get("pItemName", "").strip().upper()

            item_match = item_name_map.get(name_key) if item_name_map else None
            med_match_codes = med_name_map.get(name_key) if med_name_map else None

            if item_match is not None:
                expected_code, expected_category = item_match
                if not code:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                        "(blank)",
                        "CHECK (pItemCode REQUIRED WHEN pItemName IN LIBRARY)",
                        f"pItemName '{item.get('pItemName','')}' matches an entry in "
                        f"the eSOA Item Library (code '{expected_code}', category "
                        f"'{expected_category}'). pItemCode must not be left blank "
                        f"for items that are listed in the library.",
                        "HIGH",
                        f"Blank pItemCode for library-listed item name: {name_key}"
                    ))
                elif code != expected_code:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                        code,
                        "CHECK (pItemCode MATCHES LIBRARY FOR pItemName)",
                        f"pItemName '{item.get('pItemName','')}' matches eSOA Item "
                        f"Library code '{expected_code}', but pItemCode is '{code}'. "
                        f"The codes must match for a listed item.",
                        "HIGH",
                        f"pItemCode/pItemName mismatch: got {code}, expected {expected_code}"
                    ))
                if category and category != expected_category:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pCategory",
                        category,
                        "CHECK (pCategory MATCHES LIBRARY FOR pItemName)",
                        f"pItemName '{item.get('pItemName','')}' is listed in the "
                        f"eSOA Item Library under category '{expected_category}', "
                        f"but pCategory is '{category}'. The category cannot be "
                        f"freely chosen for items that exist in the library.",
                        "HIGH",
                        f"pCategory/pItemName mismatch: got {category}, expected {expected_category}"
                    ))

            elif med_match_codes is not None:
                if not code:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                        "(blank)",
                        "CHECK (pItemCode REQUIRED WHEN pItemName IN MEDICINE LIBRARY)",
                        f"pItemName '{item.get('pItemName','')}' matches an entry in "
                        f"the Medicine Library (code(s): {', '.join(med_match_codes)}). "
                        f"pItemCode must not be left blank for drugs listed in the "
                        f"library.",
                        "HIGH",
                        f"Blank pItemCode for library-listed drug name: {name_key}"
                    ))
                elif code not in med_match_codes:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pItemCode",
                        code,
                        "CHECK (pItemCode MATCHES MEDICINE LIBRARY FOR pItemName)",
                        f"pItemName '{item.get('pItemName','')}' matches the Medicine "
                        f"Library under code(s) {', '.join(med_match_codes)}, but "
                        f"pItemCode is '{code}', which is not one of them.",
                        "HIGH",
                        f"pItemCode/pItemName mismatch: got {code}, expected one of {med_match_codes}"
                    ))
                if category and category != "DrugsAndMedicine":
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pCategory",
                        category,
                        "CHECK (pCategory='DrugsAndMedicine' FOR MEDICINE LIBRARY ITEM)",
                        f"pItemName '{item.get('pItemName','')}' is listed in the "
                        f"Medicine Library, so pCategory must be 'DrugsAndMedicine', "
                        f"not '{category}'.",
                        "HIGH",
                        f"pCategory mismatch for medicine item: got {category}"
                    ))
            # else: pItemName has no match in either library - pItemCode
            # blank is expected (covered by FK check) and any of the 6
            # categories is acceptable, no further cross-check needed.

            # --------------------------------------------------------
            # FIX 2: pUnitOfMeasurement must be blank for DrugsAndMedicine
            # --------------------------------------------------------
            if category == "DrugsAndMedicine" and unit:
                errors.append(make_error(
                    fname, item.sourceline, "ItemizedBillingItem", "pUnitOfMeasurement",
                    unit,
                    "CHECK (pUnitOfMeasurement IS BLANK WHEN pCategory='DrugsAndMedicine')",
                    f"pUnitOfMeasurement must be left blank for items in the "
                    f"DrugsAndMedicine category. Got: '{unit}'.",
                    "MEDIUM",
                    f"Non-blank pUnitOfMeasurement '{unit}' for DrugsAndMedicine item"
                ))

            # --------------------------------------------------------
            # FIX 3: pTotalAmount must equal pUnitPrice x pQuantity
            # --------------------------------------------------------
            if unit_price is not None and quantity_raw.isdigit() and total_amount is not None:
                quantity = Decimal(quantity_raw)
                expected_total = unit_price * quantity
                if abs(total_amount - expected_total) > AMOUNT_TOLERANCE:
                    errors.append(make_error(
                        fname, item.sourceline, "ItemizedBillingItem", "pTotalAmount",
                        str(total_amount),
                        "CHECK (pTotalAmount = pUnitPrice * pQuantity)",
                        f"pTotalAmount ({total_amount}) does not equal "
                        f"pUnitPrice ({unit_price}) x pQuantity ({quantity}) = "
                        f"{expected_total}.",
                        "HIGH",
                        f"Amount mismatch: declared={total_amount}, expected={expected_total}"
                    ))

            # --------------------------------------------------------
            # FIX 4: pCategory must correspond to a category block present
            # in SummaryOfFees
            # --------------------------------------------------------
            if category and active_categories and category not in active_categories:
                errors.append(make_error(
                    fname, item.sourceline, "ItemizedBillingItem", "pCategory",
                    category,
                    "CHECK (pCategory EXISTS IN SummaryOfFees)",
                    f"pCategory '{category}' on item #{i} does not correspond "
                    f"to any category block present in SummaryOfFees for this claim.",
                    "MEDIUM",
                    f"pCategory '{category}' not found among SummaryOfFees categories"
                ))

    # ------------------------------------------------------------------
    # FIX 10: Items-vs-Summary reconciliation. The sum of pTotalAmount
    # for all ItemizedBillingItem rows under a given pCategory must
    # match that category's SummaryOfFee.pChargesNetOfApplicableVat
    # (within tolerance). Catches cases where the itemized breakdown
    # doesn't actually add up to the declared category charge.
    # Oracle: CHECK (SUM(ItemizedBillingItem.pTotalAmount) WHERE
    #                pCategory = X = SummaryOfFee.pChargesNetOfApplicableVat
    #                FOR category X)
    # ------------------------------------------------------------------
    if summary is not None:
        for cat_name in CATEGORY_ELEMENTS:
            if cat_name in category_totals_parse_failed:
                continue  # already caught by XSD pattern errors
            cat_el = summary.find(cat_name)
            if cat_el is None:
                continue
            sof = cat_el.find("SummaryOfFee")
            if sof is None:
                continue
            declared_charge = to_decimal(sof.get("pChargesNetOfApplicableVat", ""))
            if declared_charge is None:
                continue
            items_total = category_item_totals[cat_name]
            if abs(items_total - declared_charge) > AMOUNT_TOLERANCE:
                errors.append(make_error(
                    fname, sof.sourceline, "SummaryOfFee", "pChargesNetOfApplicableVat",
                    str(declared_charge),
                    "CHECK (SUM(ItemizedBillingItem.pTotalAmount) = pChargesNetOfApplicableVat)",
                    f"For category '{cat_name}', the sum of ItemizedBillingItem "
                    f"pTotalAmount values ({items_total:.2f}) does not match the "
                    f"declared pChargesNetOfApplicableVat ({declared_charge:.2f}) "
                    f"in SummaryOfFees.",
                    "HIGH",
                    f"Items total ({items_total:.2f}) != Summary charge "
                    f"({declared_charge:.2f}) for category {cat_name}"
                ))

    return errors


# ---------------------------------------------------------------------------
# VALIDATE SINGLE XML FILE
# ---------------------------------------------------------------------------
def validate_xml_file(xml_path: Path, xsd_schema: etree.XMLSchema,
                       item_codes: set, med_codes: set,
                       item_name_map: dict = None, med_name_map: dict = None) -> list:
    errors = []

    # Parse
    try:
        xml_doc = etree.parse(str(xml_path))
    except etree.XMLSyntaxError as e:
        errors.append(make_error(
            xml_path.name, getattr(e, "lineno", "?"), "N/A", "N/A", "N/A",
            "XML PARSE ERROR",
            f"XML is not well-formed: {str(e)}",
            "CRITICAL", str(e)
        ))
        return errors

    # XSD validation
    xsd_schema.validate(xml_doc)
    for err in xsd_schema.error_log:
        constraint, description, severity = classify_error(err.message)
        field, bad_value = extract_context(err.message)
        path_parts = err.path.split("/") if err.path else []
        element = path_parts[-1].split("[")[0] if path_parts else "N/A"
        errors.append(make_error(
            xml_path.name, err.line, element, field, bad_value,
            constraint, description, severity, err.message
        ))

    # Business rules (only if XSD structure passed enough to parse tree)
    try:
        biz_errors = run_business_rules(xml_path, xml_doc, item_codes, med_codes,
                                         item_name_map, med_name_map)
        errors.extend(biz_errors)
    except Exception as ex:
        errors.append(make_error(
            xml_path.name, "?", "N/A", "N/A", "N/A",
            "VALIDATOR ERROR",
            f"Business rule check failed: {str(ex)}",
            "MEDIUM", str(ex)
        ))

    return errors


# ---------------------------------------------------------------------------
# CONSOLE REPORT
# ---------------------------------------------------------------------------
def print_oracle_console_report(all_results: list, total_files: int,
                                 seen_transmittal_ids: dict):
    width = 104
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print()
    print("=" * width)
    print("  eSOA VALIDATION REPORT  -  Oracle-Style Constraint Violation Summary".center(width))
    print("=" * width)
    print(f"  Run Date/Time : {now}")
    print(f"  Schema        : ESOA_validated.xsd (Annex F enriched)")
    print(f"  Total Files   : {total_files}")
    passed = sum(1 for r in all_results if not r["errors"])
    failed = total_files - passed
    print(f"  PASSED        : {passed}")
    print(f"  FAILED        : {failed}")

    dupes = {tid: files for tid, files in seen_transmittal_ids.items() if len(files) > 1}
    if dupes:
        print(f"\n  [!] UNIQUE CONSTRAINT (pHciTransmittalId) VIOLATIONS - Cross-file duplicates:")
        for tid, files in dupes.items():
            print(f"      pHciTransmittalId {tid} found in: {', '.join(files)}")
    print("=" * width)

    for result in all_results:
        fname = result["file"]
        errors = result["errors"]
        status = "PASS" if not errors else "FAIL"
        print(f"\n  FILE: {fname}  [  {status}  ]")
        print(f"  {'=' * (width - 4)}")

        if not errors:
            print(f"  No constraint violations found. XML conforms to ESOA_validated.xsd.")
            continue

        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            sev_errors = [e for e in errors if e["severity"] == severity]
            if not sev_errors:
                continue
            print(f"\n  >> {severity} VIOLATIONS ({len(sev_errors)})")
            print(f"  {'-' * 100}")
            print(f"  {'#':<4} {'LINE':<6} {'ELEMENT':<20} {'FIELD':<25} {'ORACLE CONSTRAINT':<30} {'BAD VALUE'}")
            print(f"  {'-' * 100}")
            for i, e in enumerate(sev_errors, 1):
                bv = e["bad_value"][:22] if e["bad_value"] != "N/A" else "N/A"
                print(f"  {i:<4} {str(e['line']):<6} {e['element'][:19]:<20} "
                      f"{e['field'][:24]:<25} {e['oracle_constraint'][:29]:<30} {bv}")
                for dl in textwrap.wrap(e["description"], width=90):
                    print(f"  {'':60} -> {dl}")

        total_e = len(errors)
        critical = len([e for e in errors if e["severity"] == "CRITICAL"])
        high = len([e for e in errors if e["severity"] == "HIGH"])
        medium = len([e for e in errors if e["severity"] == "MEDIUM"])
        print(f"\n  SUMMARY: {total_e} violation(s)  "
              f"[CRITICAL: {critical}  HIGH: {high}  MEDIUM: {medium}]")

    print()
    print("=" * width)
    print(f"  END OF REPORT  |  {now}")
    print("=" * width)
    print()


# ---------------------------------------------------------------------------
# EXCEL REPORT
# ---------------------------------------------------------------------------
def write_excel_report(all_results: list, output_path: str,
                        xsd_path: str, seen_transmittal_ids: dict):
    wb = Workbook()

    C_NAV = "1F3864"
    C_WHITE = "FFFFFF"
    C_CRIT = "C00000"
    C_HIGH = "FF0000"
    C_MED = "FF8C00"
    C_PASS = "375623"
    C_PASSBG = "E2EFDA"
    C_FAILBG = "FCE4D6"
    C_ODD = "FFFFFF"
    C_EVEN = "F2F2F2"
    C_METABG = "D9E1F2"

    thin = Side(style="thin", color="AAAAAA")
    med = Side(style="medium", color="444444")
    TB = Border(left=thin, right=thin, top=thin, bottom=thin)
    MB = Border(left=med, right=med, top=med, bottom=med)

    def hdr(ws, r, c, v, bg=C_NAV, fg=C_WHITE, size=11):
        cell = ws.cell(row=r, column=c, value=v)
        cell.font = Font(bold=True, color=fg, size=size)
        cell.fill = PatternFill("solid", fgColor=bg)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = MB
        return cell

    def dat(ws, r, c, v, bold=False, fg="000000", bg=None, align="left"):
        cell = ws.cell(row=r, column=c, value=v)
        cell.font = Font(bold=bold, color=fg, size=10)
        cell.fill = PatternFill("solid", fgColor=bg) if bg else PatternFill()
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
        cell.border = TB
        return cell

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_files = len(all_results)
    passed = sum(1 for r in all_results if not r["errors"])
    failed = total_files - passed
    dupes = {tid: files for tid, files in seen_transmittal_ids.items() if len(files) > 1}

    # ===================================================================
    # SHEET 1 - VALIDATION SUMMARY
    # ===================================================================
    ws1 = wb.active
    ws1.title = "VALIDATION SUMMARY"
    ws1.sheet_view.showGridLines = False
    for col, w in zip("ABCDEF", [32, 52, 14, 14, 14, 14]):
        ws1.column_dimensions[col].width = w
    ws1.row_dimensions[1].height = 35

    ws1.merge_cells("A1:F1")
    t = ws1.cell(row=1, column=1,
                 value="eSOA VALIDATION REPORT  -  Oracle-Style Constraint Summary  v1.0")
    t.font = Font(bold=True, color=C_WHITE, size=14)
    t.fill = PatternFill("solid", fgColor=C_NAV)
    t.alignment = Alignment(horizontal="center", vertical="center")

    meta = [
        ("Run Date/Time", now),
        ("Schema File", xsd_path),
        ("Annex", "Annex F - Data Dictionary validateESOA"),
        ("Total Files", total_files),
        ("PASSED", passed),
        ("FAILED", failed),
        ("pHciTransmittalId Duplicates (cross-file)",
         ", ".join(dupes.keys()) if dupes else "None"),
    ]
    for i, (k, v) in enumerate(meta, start=2):
        ws1.row_dimensions[i].height = 20
        dat(ws1, i, 1, k, bold=True, bg=C_METABG)
        c = dat(ws1, i, 2, v)
        if k == "PASSED":
            c.font = Font(bold=True, color=C_PASS, size=10)
        if k == "FAILED" and isinstance(v, int) and v > 0:
            c.font = Font(bold=True, color=C_CRIT, size=10)
        if k == "pHciTransmittalId Duplicates (cross-file)" and v != "None":
            c.font = Font(bold=True, color=C_CRIT, size=10)

    r = len(meta) + 3
    ws1.row_dimensions[r].height = 22
    for col, h in enumerate(
        ["FILE NAME", "STATUS", "CRITICAL", "HIGH", "MEDIUM", "TOTAL ERRORS"], 1
    ):
        hdr(ws1, r, col, h)

    for result in all_results:
        r += 1
        ws1.row_dimensions[r].height = 18
        errors = result["errors"]
        status = "PASS" if not errors else "FAIL"
        critical = len([e for e in errors if e["severity"] == "CRITICAL"])
        high = len([e for e in errors if e["severity"] == "HIGH"])
        medium = len([e for e in errors if e["severity"] == "MEDIUM"])
        total_e = len(errors)
        bg = C_PASSBG if not errors else C_FAILBG

        dat(ws1, r, 1, result["file"], bg=bg)
        dat(ws1, r, 2, status, bold=True, bg=bg,
            fg=C_PASS if not errors else C_CRIT, align="center")
        dat(ws1, r, 3, critical, bg=bg, align="center")
        dat(ws1, r, 4, high, bg=bg, align="center")
        dat(ws1, r, 5, medium, bg=bg, align="center")
        dat(ws1, r, 6, total_e, bg=bg, align="center")

    # ===================================================================
    # SHEET 2 - VIOLATION DETAILS
    # ===================================================================
    ws2 = wb.create_sheet("VIOLATION DETAILS")
    ws2.sheet_view.showGridLines = False

    col_widths = [28, 7, 18, 22, 22, 11, 32, 45, 55]
    col_headers = ["FILE NAME", "LINE", "ELEMENT", "FIELD", "BAD VALUE",
                   "SEVERITY", "ORACLE CONSTRAINT", "DESCRIPTION", "RAW lxml ERROR"]
    for i, (w, h) in enumerate(zip(col_widths, col_headers), 1):
        ws2.column_dimensions[get_column_letter(i)].width = w

    ws2.merge_cells("A1:I1")
    t2 = ws2.cell(row=1, column=1,
                  value="eSOA VIOLATION DETAILS - Oracle Constraint Errors  v1.0")
    t2.font = Font(bold=True, color=C_WHITE, size=13)
    t2.fill = PatternFill("solid", fgColor=C_NAV)
    t2.alignment = Alignment(horizontal="center", vertical="center")
    ws2.row_dimensions[1].height = 30

    for col, h in enumerate(col_headers, 1):
        hdr(ws2, 2, col, h)
    ws2.row_dimensions[2].height = 22

    det_row = 3
    row_num = 0
    for result in all_results:
        errors = result["errors"]
        if not errors:
            continue
        sorted_errors = sorted(
            errors, key=lambda e: (SEVERITY_ORDER.get(e["severity"], 9), e["line"])
        )
        for e in sorted_errors:
            row_num += 1
            bg = C_ODD if row_num % 2 == 0 else C_EVEN
            sev_color = (C_CRIT if e["severity"] == "CRITICAL" else
                         C_HIGH if e["severity"] == "HIGH" else C_MED)

            ws2.row_dimensions[det_row].height = 30
            dat(ws2, det_row, 1, e["file"], bg=bg)
            dat(ws2, det_row, 2, e["line"], bg=bg, align="center")
            dat(ws2, det_row, 3, e["element"], bg=bg)
            dat(ws2, det_row, 4, e["field"], bg=bg)
            dat(ws2, det_row, 5, e["bad_value"], bg=bg)
            sc = ws2.cell(row=det_row, column=6, value=e["severity"])
            sc.font = Font(bold=True, color=sev_color, size=10)
            sc.fill = PatternFill("solid", fgColor=bg)
            sc.alignment = Alignment(horizontal="center", vertical="center")
            sc.border = TB
            dat(ws2, det_row, 7, e["oracle_constraint"], bg=bg, bold=True)
            dat(ws2, det_row, 8, e["description"], bg=bg)
            dat(ws2, det_row, 9, e["raw_error"], bg=bg)
            det_row += 1

    if det_row == 3:
        ws2.merge_cells("A3:I3")
        ok = ws2.cell(row=3, column=1,
                      value="No violations found. All files passed XSD + business rule validation.")
        ok.font = Font(bold=True, color=C_PASS, size=11)
        ok.fill = PatternFill("solid", fgColor=C_PASSBG)
        ok.alignment = Alignment(horizontal="center", vertical="center")

    if dupes:
        det_row += 2
        ws2.merge_cells(f"A{det_row}:I{det_row}")
        dh = ws2.cell(row=det_row, column=1,
                      value="CROSS-FILE UNIQUE CONSTRAINT VIOLATIONS - Duplicate pHciTransmittalId")
        dh.font = Font(bold=True, color=C_WHITE, size=11)
        dh.fill = PatternFill("solid", fgColor=C_CRIT)
        dh.alignment = Alignment(horizontal="center", vertical="center")
        det_row += 1
        for tid, files in dupes.items():
            ws2.merge_cells(f"A{det_row}:I{det_row}")
            dc = ws2.cell(row=det_row, column=1,
                          value=f"pHciTransmittalId '{tid}' duplicated in: {', '.join(files)}")
            dc.font = Font(bold=True, color=C_CRIT, size=10)
            dc.fill = PatternFill("solid", fgColor=C_FAILBG)
            dc.alignment = Alignment(horizontal="left", vertical="center")
            det_row += 1

    # ===================================================================
    # SHEET 3 - ORACLE CONSTRAINT REFERENCE
    # ===================================================================
    ws3 = wb.create_sheet("ORACLE CONSTRAINT REFERENCE")
    ws3.sheet_view.showGridLines = False

    ref_widths = [20, 26, 34, 30, 50, 12]
    ref_headers = ["ELEMENT", "FIELD", "ORACLE CONSTRAINT", "XSD/PYTHON RULE",
                   "DESCRIPTION", "ENFORCED BY"]
    for i, (w, h) in enumerate(zip(ref_widths, ref_headers), 1):
        ws3.column_dimensions[get_column_letter(i)].width = w

    ws3.merge_cells("A1:F1")
    t3 = ws3.cell(row=1, column=1,
                  value="Oracle Constraint Reference - ESOA_validated.xsd (Annex F)  v1.0")
    t3.font = Font(bold=True, color=C_WHITE, size=13)
    t3.fill = PatternFill("solid", fgColor=C_NAV)
    t3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 30

    for i, h in enumerate(ref_headers, 1):
        hdr(ws3, 2, i, h)

    ref_data = [
        ("eSOA", "pHciPan", "VARCHAR2(9) NOT NULL",
         "maxLength=9",
         "PhilHealth accreditation number of the health facility", "XSD"),

        ("eSOA", "pHciTransmittalId", "VARCHAR2(50) NOT NULL + UNIQUE",
         "maxLength=50 + cross-file duplicate check",
         "Unique reference number per claim submission across the batch", "XSD + Python"),

        ("SummaryOfFee", "pChargesNetOfApplicableVat", "NUMBER(10,2) NOT NULL",
         "pattern=[0-9]{1,8}\\.[0-9]{2}",
         "Total charges net of VAT. Range 0.00 to 99999999.99", "XSD"),

        ("SummaryOfFee", "discount fields (6)", "NUMBER(10,2) NOT NULL + CHECK <= charges",
         "pattern + discount <= pChargesNetOfApplicableVat",
         "SeniorCitizen/PWD/PCSO/DSWD/DOHMAP/HMO discounts can't exceed gross charge", "XSD + Python"),

        ("PhilHealth", "pTotalCaseRateAmount", "NUMBER(8,2) NOT NULL",
         "pattern=[0-9]{1,6}\\.[0-9]{2}",
         "Case rate amount being claimed. Range 0.00 to 999999.99", "XSD"),

        ("Balance", "pAmount", "NUMBER(10,2) NOT NULL + CHECK = Charges-Discounts-OtherFunds-CaseRate",
         "pattern (negative allowed) + arithmetic balance check incl. OtherFundSource (tolerance 0.01)",
         "Balance must equal computed remainder incl. other funding sources; may be negative", "XSD + Python"),

        ("SummaryOfFee / ItemizedBillingItem", "pChargesNetOfApplicableVat vs SUM(pTotalAmount)",
         "CHECK (category items total = category charge)",
         "per-category reconciliation, tolerance 0.01",
         "Itemized breakdown per category must add up to the declared category charge", "Python"),

        ("OtherFundSource", "pDescription / pAmount", "VARCHAR2(4000) + NUMBER(10,2) + UNIQUE",
         "maxLength + amount pattern + cross-category duplicate check",
         "Optional, present only if applicable; pDescription unique across whole claim", "XSD + Python"),

        ("ProfessionalInfo", "pPAN / pFirstName / pLastName", "VARCHAR2(14) / (60) / (60) NOT NULL",
         "maxLength constraints",
         "Attending physician identity fields", "XSD"),

        ("ProfessionalInfo", "pMiddleName / pSuffixName", "VARCHAR2 NOT NULL (blank allowed)",
         "required attribute, no minLength",
         "Required field, may be blank (e.g. no suffix)", "XSD"),

        ("ItemizedBillingItem", "pServiceDate", "DATE NOT NULL",
         "pattern=mm-dd-yyyy",
         "Date of service or issuance for the billing item", "XSD"),

        ("ItemizedBillingItem", "pItemCode", "VARCHAR2(30) NOT NULL (blank allowed) + FK",
         "maxLength=30 + category-routed lookup: DrugsAndMedicine->Medicine Lib, else->Item Lib",
         "Required field, blank if not in applicable library; else must match by category", "XSD + Python"),

        ("ItemizedBillingItem", "pItemCode / pCategory", "CHECK (must reflect library when pItemName matches)",
         "name-to-code/category cross-check against both libraries",
         "If pItemName is in the library, code/category can't be blank or freely chosen", "Python"),

        ("ItemizedBillingItem", "pUnitOfMeasurement", "VARCHAR2(50) NOT NULL + CHECK blank if Drugs",
         "maxLength=50 + conditional blank rule",
         "Must be blank when pCategory = DrugsAndMedicine", "XSD + Python"),

        ("ItemizedBillingItem", "pUnitPrice / pQuantity / pTotalAmount",
         "NUMBER(8,2) / NUMBER(4,0) / NUMBER(11,2) + CHECK arithmetic",
         "patterns + pTotalAmount = pUnitPrice * pQuantity",
         "Quantity 0-9999; total amount must match unit price x quantity", "XSD + Python"),

        ("ItemizedBillingItem", "pCategory", "VARCHAR2(50) NOT NULL + CHECK IN LIST + cross-check",
         "enumeration (6 values) + must exist in SummaryOfFees",
         "Must be one of the 6 categories, and present in SummaryOfFees", "XSD + Python"),
    ]

    for i, row in enumerate(ref_data, start=3):
        bg = C_ODD if i % 2 == 0 else C_EVEN
        ws3.row_dimensions[i].height = 28
        for col, val in enumerate(row, 1):
            dat(ws3, i, col, val, bg=bg)

    wb.save(output_path)
    print(f"\n  [EXCEL] Report saved: {output_path}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="eSOA XSD Validator v1.0 - Oracle-style constraint reporting",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          python esoa_xsd_validator.py --xml claim.xml --xsd ESOA_validated.xsd
                                       --items ESOA_Item_Library.csv --meds ESOA_Medicine_Library.csv

          python esoa_xsd_validator.py --xml ./batch/ --xsd ESOA_validated.xsd
                                       --items ESOA_Item_Library.csv --meds ESOA_Medicine_Library.csv
                                       --recursive --out report.xlsx
        """)
    )
    parser.add_argument("--xml", required=True, help="eSOA XML file or folder")
    parser.add_argument("--xsd", required=True, help="Path to ESOA_validated.xsd")
    parser.add_argument("--items", default=None, help="ESOA_Item_Library.csv (optional)")
    parser.add_argument("--meds", default=None, help="ESOA_Medicine_Library.csv (optional)")
    parser.add_argument("--out", default=None, help="Output Excel filename")
    parser.add_argument("--recursive", action="store_true",
                         help="Search subfolders recursively for XML files")
    args = parser.parse_args()

    # Load XSD
    xsd_path = Path(args.xsd)
    if not xsd_path.exists():
        print(f"[ERROR] XSD not found: {xsd_path}"); sys.exit(1)
    try:
        xsd_schema = etree.XMLSchema(etree.parse(str(xsd_path)))
    except Exception as e:
        print(f"[ERROR] Failed to load XSD: {e}"); sys.exit(1)

    # Load Item Library master list
    item_codes = set()
    item_name_map = {}
    if args.items:
        items_path = Path(args.items)
        if not items_path.exists():
            print(f"[WARNING] Item Library CSV not found: {items_path} - skipping pItemCode lookup")
        else:
            item_codes, item_name_map = load_item_library(str(items_path))
            print(f"  [INFO] Loaded {len(item_codes):,} item codes from {items_path.name}")

    # Load Medicine Library master list
    med_codes = set()
    med_name_map = {}
    if args.meds:
        meds_path = Path(args.meds)
        if not meds_path.exists():
            print(f"[WARNING] Medicine Library CSV not found: {meds_path} - skipping drug code lookup")
        else:
            med_codes, med_name_map = load_medicine_library(str(meds_path))
            print(f"  [INFO] Loaded {len(med_codes):,} drug codes from {meds_path.name}")

    # Collect XML files
    xml_input = Path(args.xml)
    if xml_input.is_dir():
        if args.recursive:
            xml_files = sorted(xml_input.rglob("*.xml"))
        else:
            xml_files = sorted(xml_input.glob("*.xml"))
    elif xml_input.is_file():
        xml_files = [xml_input]
    else:
        print(f"[ERROR] Path not found: {xml_input}"); sys.exit(1)

    if not xml_files:
        print(f"[ERROR] No XML files found in: {xml_input}"); sys.exit(1)

    print(f"  [INFO] Validating {len(xml_files)} XML file(s)...\n")

    # Track pHciTransmittalId across files for UNIQUE constraint
    seen_transmittal_ids = {}  # {transmittal_id: [file1, file2, ...]}

    # Validate each file
    all_results = []
    for xml_file in xml_files:
        errors = validate_xml_file(xml_file, xsd_schema, item_codes, med_codes,
                                    item_name_map, med_name_map)
        all_results.append({"file": xml_file.name, "errors": errors})

        # Extract pHciTransmittalId for cross-file uniqueness check
        try:
            doc = etree.parse(str(xml_file))
            root = doc.getroot()
            tid = root.get("pHciTransmittalId", "").strip()
            if tid:
                seen_transmittal_ids.setdefault(tid, []).append(xml_file.name)
        except Exception:
            pass

    # Add cross-file duplicate errors to affected files
    dupes = {tid: files for tid, files in seen_transmittal_ids.items() if len(files) > 1}
    for tid, files in dupes.items():
        for result in all_results:
            if result["file"] in files:
                result["errors"].append(make_error(
                    result["file"], "N/A", "eSOA", "pHciTransmittalId", tid,
                    "UNIQUE CONSTRAINT (pHciTransmittalId across batch)",
                    f"pHciTransmittalId '{tid}' appears in multiple files: {', '.join(files)}. "
                    f"Oracle UNIQUE constraint violation across batch submission.",
                    "CRITICAL",
                    f"Duplicate pHciTransmittalId across files: {', '.join(files)}"
                ))

    # Reports
    print_oracle_console_report(all_results, len(xml_files), seen_transmittal_ids)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = args.out if args.out else f"esoa_validation_report_{timestamp}.xlsx"
    write_excel_report(all_results, out_path, str(xsd_path), seen_transmittal_ids)


if __name__ == "__main__":
    main()
