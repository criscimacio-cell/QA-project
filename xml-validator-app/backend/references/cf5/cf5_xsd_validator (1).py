#!/usr/bin/env python3
"""
=============================================================================
CF5 eClaims XSD Validator - Oracle-Style Validation Report  v2.0
=============================================================================
Schema   : CF5_validated.xsd (Annex E enriched)
Output   : Console report + Excel (3 sheets)

Fixes implemented in v2.0:
  FIX 1  - NewBornAdmWeight required field, blank when N/A; if a value
           is given it must be > 0.3 and <= 6.0
  FIX 2  - ICD-10 validated against ICD10_Case_Rates.csv master list
  FIX 3  - RVS Code validated against RVS_Case_Rates.csv master list
  FIX 4  - UTF-8 byte-length check on Remarks fields (2000 bytes max)
  FIX 5  - Duplicate SecondaryCode per claim detection
  FIX 5b - SecondaryCode must not duplicate the claim's PrimaryCode
  FIX 6  - Duplicate RvsCode per claim detection
  FIX 7  - ClaimNumber uniqueness across batch (UNIQUE constraint)
  FIX 8  - Recursive folder support (--recursive flag)
  BONUS  - Raw lxml error included in Excel VIOLATION DETAILS sheet

Oracle Constraint Equivalents:
  NOT NULL        -> use="required"
  VARCHAR2(n)     -> xs:maxLength  + UTF-8 byte check (FIX 4)
  CHECK (REGEXP)  -> xs:pattern
  CHECK (IN list) -> xs:enumeration
  NUMBER(p,s)     -> xs:pattern + numeric range check (FIX 1)
  UNIQUE          -> cross-file ClaimNumber check (FIX 7)
  FK / MASTER     -> CSV lookup for ICD-10 and RVS (FIX 2, 3)
  ROW COUNT       -> xs:maxOccurs (12 diags, 20 procs)
=============================================================================
Usage:
  python cf5_xsd_validator.py --xml claim.xml   --xsd CF5_validated.xsd
                               --icd ICD10_Case_Rates.csv
                               --rvs RVS_Case_Rates.csv

  python cf5_xsd_validator.py --xml ./batch/  --xsd CF5_validated.xsd
                               --icd ICD10_Case_Rates.csv
                               --rvs RVS_Case_Rates.csv
                               --recursive --out report.xlsx
=============================================================================
"""

import argparse
import os
import re
import sys
import textwrap
from datetime import datetime
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
     "Element count exceeds maximum allowed occurrences (Annex E row limit).",
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


# ---------------------------------------------------------------------------
# Load reference master lists
# ---------------------------------------------------------------------------
def load_icd10_codes(csv_path: str) -> set:
    """
    Load valid ICD-10 codes from CSV.
    Handles compound codes like 'A01.0+ J17.0*' by splitting and indexing
    each individual code separately.
    Oracle equiv: FK reference to ICD10_MASTER table
    """
    df = pd.read_csv(csv_path, dtype=str)
    codes = set()
    for raw in df["Code"].dropna():
        raw = raw.strip()
        # Compound codes: 'A01.0+ J17.0*' — split on space and strip symbols
        parts = re.split(r"[\s]+", raw)
        for part in parts:
            clean = re.sub(r"[+*]", "", part).strip()
            if clean:
                codes.add(clean.upper())
    return codes


def load_rvs_codes(csv_path: str) -> set:
    """
    Load valid RVS codes from CSV.
    Oracle equiv: FK reference to RVS_MASTER table
    """
    df = pd.read_csv(csv_path, dtype=str)
    return set(df["Code"].dropna().str.strip())


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


def utf8_byte_len(value: str) -> int:
    return len(value.encode("utf-8"))


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
# POST-XSD BUSINESS RULE CHECKS (the 8 fixes)
# ---------------------------------------------------------------------------
def run_business_rules(xml_path: Path, xml_doc, icd10_codes: set, rvs_codes: set) -> list:
    """
    Run all post-XSD business rule checks that XSD cannot enforce.
    Returns list of error dicts.
    """
    errors = []
    fname = xml_path.name
    root = xml_doc.getroot()

    drgclaim = root.find("DRGCLAIM")
    if drgclaim is None:
        return errors

    # ------------------------------------------------------------------
    # FIX 1: NewBornAdmWeight is a REQUIRED field (attribute must be
    # present in the XML), but its VALUE is left blank when the claim
    # is not a newborn case. Only validate the 0.3-6.0 range when a
    # value is actually provided.
    # Annex E: greater than 0.3 kg | App cap: max 6.0 kg
    # Oracle: CHECK (val = '' OR (val > 0.3 AND val <= 6.0))
    # ------------------------------------------------------------------
    weight_raw = drgclaim.get("NewBornAdmWeight", "").strip()
    if weight_raw:
        try:
            weight_val = float(weight_raw)
            if weight_val <= 0.3 or weight_val > 6.0:
                errors.append(make_error(
                    fname, drgclaim.sourceline, "DRGCLAIM", "NewBornAdmWeight",
                    weight_raw,
                    "CHECK (NewBornAdmWeight > 0.3 AND <= 6.0)",
                    f"The admission weight must be greater than 0.3 and up to 6.0 kg. "
                    f"Got: {weight_raw} ({weight_val} kg). Format: ##.# (1 decimal). "
                    f"Annex E: applicable to newborns 0-27 days old.",
                    "HIGH",
                    f"Value {weight_val} fails CHECK (NewBornAdmWeight > 0.3 AND <= 6.0)"
                ))
        except ValueError:
            pass  # already caught by XSD pattern check
    # else: value left blank — valid when the claim is not a newborn case.

    # ------------------------------------------------------------------
    # FIX 2: ICD-10 PrimaryCode against master list
    # Oracle: FK CHECK (PrimaryCode IN (SELECT Code FROM ICD10_MASTER))
    # ------------------------------------------------------------------
    primary = drgclaim.get("PrimaryCode", "").strip().upper()
    if primary and icd10_codes and primary not in icd10_codes:
        errors.append(make_error(
            fname, drgclaim.sourceline, "DRGCLAIM", "PrimaryCode",
            primary,
            "FK / ICD10_MASTER NOT FOUND",
            f"PrimaryCode '{primary}' not found in ICD10 Case Rates master list. "
            f"Must be a valid PhilHealth-recognized ICD-10 code.",
            "HIGH",
            f"ICD-10 lookup failed for PrimaryCode: {primary}"
        ))

    # ------------------------------------------------------------------
    # FIX 2: ICD-10 SecondaryCode against master list + FIX 5: duplicates
    # Oracle: FK CHECK + UNIQUE(ClaimNumber, SecondaryCode)
    # ------------------------------------------------------------------
    seen_secondary = {}
    for i, diag in enumerate(root.findall(".//SECONDARYDIAG"), start=1):
        code = diag.get("SecondaryCode", "").strip().upper()

        # FK check
        if code and icd10_codes and code not in icd10_codes:
            errors.append(make_error(
                fname, diag.sourceline, "SECONDARYDIAG", "SecondaryCode",
                code,
                "FK / ICD10_MASTER NOT FOUND",
                f"SecondaryCode '{code}' not found in ICD10 Case Rates master list.",
                "HIGH",
                f"ICD-10 lookup failed for SecondaryCode: {code}"
            ))

        # FIX 2b: SecondaryCode must not duplicate the claim's PrimaryCode
        if code and primary and code == primary:
            errors.append(make_error(
                fname, diag.sourceline, "SECONDARYDIAG", "SecondaryCode",
                code,
                "UNIQUE CONSTRAINT (SecondaryCode != PrimaryCode)",
                f"SecondaryCode '{code}' duplicates the claim's PrimaryCode. "
                f"A diagnosis already recorded as primary must not be repeated as secondary.",
                "HIGH",
                f"SecondaryCode equals PrimaryCode: {code}"
            ))

        # FIX 5: Duplicate secondary code
        if code:
            if code in seen_secondary:
                errors.append(make_error(
                    fname, diag.sourceline, "SECONDARYDIAG", "SecondaryCode",
                    code,
                    "UNIQUE CONSTRAINT (SecondaryCode per claim)",
                    f"Duplicate SecondaryCode '{code}' found in SECONDARYDIAGS. "
                    f"First occurrence at row {seen_secondary[code]}, duplicate at row {i}.",
                    "HIGH",
                    f"Duplicate SecondaryCode: {code}"
                ))
            else:
                seen_secondary[code] = i

    # ------------------------------------------------------------------
    # FIX 3: RVS Code against master list + FIX 6: duplicate RvsCode
    # Oracle: FK CHECK + UNIQUE(ClaimNumber, RvsCode)
    # ------------------------------------------------------------------
    seen_rvs = {}
    for i, proc in enumerate(root.findall(".//PROCEDURE"), start=1):
        rvs = proc.get("RvsCode", "").strip()

        # FK check
        if rvs and rvs_codes and rvs not in rvs_codes:
            errors.append(make_error(
                fname, proc.sourceline, "PROCEDURE", "RvsCode",
                rvs,
                "FK / RVS_MASTER NOT FOUND",
                f"RvsCode '{rvs}' not found in RVS Case Rates master list. "
                f"Must be a valid PhilHealth-recognized RVS code.",
                "HIGH",
                f"RVS lookup failed for RvsCode: {rvs}"
            ))

        # FIX 6: Duplicate RvsCode per claim
        if rvs:
            if rvs in seen_rvs:
                errors.append(make_error(
                    fname, proc.sourceline, "PROCEDURE", "RvsCode",
                    rvs,
                    "UNIQUE CONSTRAINT (RvsCode per claim)",
                    f"Duplicate RvsCode '{rvs}' found in PROCEDURES. "
                    f"First occurrence at row {seen_rvs[rvs]}, duplicate at row {i}.",
                    "HIGH",
                    f"Duplicate RvsCode: {rvs}"
                ))
            else:
                seen_rvs[rvs] = i

    # ------------------------------------------------------------------
    # FIX 4: UTF-8 byte-length check on all Remarks fields
    # Oracle: VARCHAR2(2000 BYTE) — Oracle counts bytes not chars
    # ------------------------------------------------------------------
    BYTE_LIMIT = 2000
    remarks_targets = [
        (drgclaim, "DRGCLAIM"),
    ] + [
        (d, "SECONDARYDIAG") for d in root.findall(".//SECONDARYDIAG")
    ] + [
        (p, "PROCEDURE") for p in root.findall(".//PROCEDURE")
    ]

    for node, elem_name in remarks_targets:
        remarks = node.get("Remarks", "")
        if remarks:
            byte_len = utf8_byte_len(remarks)
            if byte_len > BYTE_LIMIT:
                errors.append(make_error(
                    fname, node.sourceline, elem_name, "Remarks",
                    f"{byte_len} bytes",
                    "CHECK (LENGTHB(Remarks) <= 2000)",
                    f"Remarks field exceeds 2000 UTF-8 bytes. "
                    f"Actual: {byte_len} bytes, {len(remarks)} chars. "
                    f"Oracle VARCHAR2(2000) counts bytes, not characters.",
                    "HIGH",
                    f"UTF-8 byte overflow: {byte_len} bytes on Remarks"
                ))

    return errors


# ---------------------------------------------------------------------------
# VALIDATE SINGLE XML FILE
# ---------------------------------------------------------------------------
def validate_xml_file(xml_path: Path, xsd_schema: etree.XMLSchema,
                      icd10_codes: set, rvs_codes: set) -> list:
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
        biz_errors = run_business_rules(xml_path, xml_doc, icd10_codes, rvs_codes)
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
                                 seen_claim_numbers: dict):
    width = 104
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print()
    print("=" * width)
    print("  CF5 eCLAIMS XSD VALIDATION REPORT  —  Oracle-Style Constraint Violation Summary".center(width))
    print("=" * width)
    print(f"  Run Date/Time : {now}")
    print(f"  Schema        : CF5_validated.xsd (Annex E enriched)")
    print(f"  Total Files   : {total_files}")
    passed = sum(1 for r in all_results if not r["errors"])
    failed = total_files - passed
    print(f"  PASSED        : {passed}")
    print(f"  FAILED        : {failed}")

    # FIX 7: Show duplicate ClaimNumbers across batch
    dupes = {cn: files for cn, files in seen_claim_numbers.items() if len(files) > 1}
    if dupes:
        print(f"\n  [!] UNIQUE CONSTRAINT (ClaimNumber) VIOLATIONS — Cross-file duplicates:")
        for cn, files in dupes.items():
            print(f"      ClaimNumber {cn} found in: {', '.join(files)}")
    print("=" * width)

    for result in all_results:
        fname  = result["file"]
        errors = result["errors"]
        status = "PASS" if not errors else "FAIL"
        print(f"\n  FILE: {fname}  [  {status}  ]")
        print(f"  {'=' * (width - 4)}")

        if not errors:
            print(f"  No constraint violations found. XML conforms to CF5_validated.xsd.")
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

        total_e  = len(errors)
        critical = len([e for e in errors if e["severity"] == "CRITICAL"])
        high     = len([e for e in errors if e["severity"] == "HIGH"])
        medium   = len([e for e in errors if e["severity"] == "MEDIUM"])
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
                       xsd_path: str, seen_claim_numbers: dict):
    wb = Workbook()

    C_NAV   = "1F3864"
    C_WHITE = "FFFFFF"
    C_CRIT  = "C00000"
    C_HIGH  = "FF0000"
    C_MED   = "FF8C00"
    C_PASS  = "375623"
    C_PASSBG= "E2EFDA"
    C_FAILBG= "FCE4D6"
    C_ODD   = "FFFFFF"
    C_EVEN  = "F2F2F2"
    C_METABG= "D9E1F2"

    thin = Side(style="thin",   color="AAAAAA")
    med  = Side(style="medium", color="444444")
    TB   = Border(left=thin, right=thin, top=thin, bottom=thin)
    MB   = Border(left=med,  right=med,  top=med,  bottom=med)

    def hdr(ws, r, c, v, bg=C_NAV, fg=C_WHITE, size=11):
        cell = ws.cell(row=r, column=c, value=v)
        cell.font   = Font(bold=True, color=fg, size=size)
        cell.fill   = PatternFill("solid", fgColor=bg)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = MB
        return cell

    def dat(ws, r, c, v, bold=False, fg="000000", bg=None, align="left"):
        cell = ws.cell(row=r, column=c, value=v)
        cell.font   = Font(bold=bold, color=fg, size=10)
        cell.fill   = PatternFill("solid", fgColor=bg) if bg else PatternFill()
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
        cell.border = TB
        return cell

    now          = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_files  = len(all_results)
    passed       = sum(1 for r in all_results if not r["errors"])
    failed       = total_files - passed
    dupes        = {cn: files for cn, files in seen_claim_numbers.items() if len(files) > 1}

    # ===================================================================
    # SHEET 1 — VALIDATION SUMMARY
    # ===================================================================
    ws1 = wb.active
    ws1.title = "VALIDATION SUMMARY"
    ws1.sheet_view.showGridLines = False
    for col, w in zip("ABCDEF", [32, 52, 14, 14, 14, 14]):
        ws1.column_dimensions[col].width = w
    ws1.row_dimensions[1].height = 35

    ws1.merge_cells("A1:F1")
    t = ws1.cell(row=1, column=1,
                 value="CF5 eCLAIMS XSD VALIDATION REPORT  —  Oracle-Style Constraint Summary  v2.0")
    t.font      = Font(bold=True, color=C_WHITE, size=14)
    t.fill      = PatternFill("solid", fgColor=C_NAV)
    t.alignment = Alignment(horizontal="center", vertical="center")

    meta = [
        ("Run Date/Time", now),
        ("Schema File",   xsd_path),
        ("Annex",         "Annex E — Data Dictionary validateCF5"),
        ("Total Files",   total_files),
        ("PASSED",        passed),
        ("FAILED",        failed),
        ("ClaimNumber Duplicates (cross-file)",
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
        if k == "ClaimNumber Duplicates (cross-file)" and v != "None":
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
        errors   = result["errors"]
        status   = "PASS" if not errors else "FAIL"
        critical = len([e for e in errors if e["severity"] == "CRITICAL"])
        high     = len([e for e in errors if e["severity"] == "HIGH"])
        medium   = len([e for e in errors if e["severity"] == "MEDIUM"])
        total_e  = len(errors)
        bg       = C_PASSBG if not errors else C_FAILBG

        dat(ws1, r, 1, result["file"], bg=bg)
        dat(ws1, r, 2, status, bold=True, bg=bg,
            fg=C_PASS if not errors else C_CRIT, align="center")
        dat(ws1, r, 3, critical, bg=bg, align="center")
        dat(ws1, r, 4, high,     bg=bg, align="center")
        dat(ws1, r, 5, medium,   bg=bg, align="center")
        dat(ws1, r, 6, total_e,  bg=bg, align="center")

    # ===================================================================
    # SHEET 2 — VIOLATION DETAILS  (FIX 7 BONUS: raw_error column added)
    # ===================================================================
    ws2 = wb.create_sheet("VIOLATION DETAILS")
    ws2.sheet_view.showGridLines = False

    col_widths  = [28, 7, 18, 22, 22, 11, 32, 45, 55]
    col_headers = ["FILE NAME", "LINE", "ELEMENT", "FIELD", "BAD VALUE",
                   "SEVERITY", "ORACLE CONSTRAINT", "DESCRIPTION", "RAW lxml ERROR"]
    for i, (w, h) in enumerate(zip(col_widths, col_headers), 1):
        ws2.column_dimensions[get_column_letter(i)].width = w

    ws2.merge_cells("A1:I1")
    t2 = ws2.cell(row=1, column=1,
                  value="CF5 VIOLATION DETAILS — Oracle Constraint Errors  v2.0")
    t2.font      = Font(bold=True, color=C_WHITE, size=13)
    t2.fill      = PatternFill("solid", fgColor=C_NAV)
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
            dat(ws2, det_row, 1, e["file"],             bg=bg)
            dat(ws2, det_row, 2, e["line"],             bg=bg, align="center")
            dat(ws2, det_row, 3, e["element"],          bg=bg)
            dat(ws2, det_row, 4, e["field"],            bg=bg)
            dat(ws2, det_row, 5, e["bad_value"],        bg=bg)
            sc = ws2.cell(row=det_row, column=6, value=e["severity"])
            sc.font      = Font(bold=True, color=sev_color, size=10)
            sc.fill      = PatternFill("solid", fgColor=bg)
            sc.alignment = Alignment(horizontal="center", vertical="center")
            sc.border    = TB
            dat(ws2, det_row, 7, e["oracle_constraint"], bg=bg, bold=True)
            dat(ws2, det_row, 8, e["description"],       bg=bg)
            dat(ws2, det_row, 9, e["raw_error"],         bg=bg)   # FIX 7 BONUS
            det_row += 1

    if det_row == 3:
        ws2.merge_cells("A3:I3")
        ok = ws2.cell(row=3, column=1,
                      value="No violations found. All files passed XSD + business rule validation.")
        ok.font      = Font(bold=True, color=C_PASS, size=11)
        ok.fill      = PatternFill("solid", fgColor=C_PASSBG)
        ok.alignment = Alignment(horizontal="center", vertical="center")

    # FIX 7: Cross-file ClaimNumber duplicates section
    if dupes:
        det_row += 2
        ws2.merge_cells(f"A{det_row}:I{det_row}")
        dh = ws2.cell(row=det_row, column=1,
                      value="CROSS-FILE UNIQUE CONSTRAINT VIOLATIONS — Duplicate ClaimNumbers")
        dh.font      = Font(bold=True, color=C_WHITE, size=11)
        dh.fill      = PatternFill("solid", fgColor=C_CRIT)
        dh.alignment = Alignment(horizontal="center", vertical="center")
        det_row += 1
        for cn, files in dupes.items():
            ws2.merge_cells(f"A{det_row}:I{det_row}")
            dc = ws2.cell(row=det_row, column=1,
                          value=f"ClaimNumber '{cn}' duplicated in: {', '.join(files)}")
            dc.font      = Font(bold=True, color=C_CRIT, size=10)
            dc.fill      = PatternFill("solid", fgColor=C_FAILBG)
            dc.alignment = Alignment(horizontal="left", vertical="center")
            det_row += 1

    # ===================================================================
    # SHEET 3 — ORACLE CONSTRAINT REFERENCE
    # ===================================================================
    ws3 = wb.create_sheet("ORACLE CONSTRAINT REF")
    ws3.sheet_view.showGridLines = False

    ref_headers = ["ELEMENT", "FIELD", "ORACLE CONSTRAINT", "XSD RULE", "ANNEX E RULE", "CHECK SOURCE"]
    ref_widths  = [18, 24, 32, 38, 45, 16]
    for i, (h, w) in enumerate(zip(ref_headers, ref_widths), 1):
        ws3.column_dimensions[get_column_letter(i)].width = w

    ws3.merge_cells("A1:F1")
    t3 = ws3.cell(row=1, column=1,
                  value="Oracle Constraint Reference — CF5_validated.xsd (Annex E)  v2.0")
    t3.font      = Font(bold=True, color=C_WHITE, size=13)
    t3.fill      = PatternFill("solid", fgColor=C_NAV)
    t3.alignment = Alignment(horizontal="center", vertical="center")
    ws3.row_dimensions[1].height = 30

    for i, h in enumerate(ref_headers, 1):
        hdr(ws3, 2, i, h)

    ref_data = [
        ("CF5",           "pHospitalCode",       "VARCHAR2(6) NOT NULL + CHECK REGEXP",
         "minLength=6, maxLength=6, pattern=[0-9]{6}|X[0-9]{5}",
         "6-digit alphanumeric. Format: 999999 or X99999", "XSD"),

        ("DRGCLAIM",      "ClaimNumber",          "VARCHAR2(13) NOT NULL + CHECK REGEXP",
         "minLength=13, maxLength=13, pattern=[0-9]{13}",
         "Format: 9999999999999 (13 digits)", "XSD"),

        ("DRGCLAIM",      "PrimaryCode",          "VARCHAR2(15) NOT NULL + FK ICD10_MASTER",
         "minLength=3, maxLength=15, pattern=ICD-10",
         "Valid ICD-10 code. Validated against ICD10_Case_Rates.csv", "XSD + Python"),

        ("DRGCLAIM",      "NewBornAdmWeight",     "VARCHAR2(4) NOT NULL (blank allowed) + CHECK",
         "attribute required; pattern=([0-9]{1,2}\\.[0-9])? + float >0.3 and <=6.0 if non-blank",
         "Required field. Blank if not a newborn case. If given: >0.3, up to 6.0 kg.", "XSD + Python"),

        ("DRGCLAIM",      "Remarks",              "VARCHAR2(2000 BYTE) NOT NULL",
         "maxLength=2000 (chars) + UTF-8 byte check <= 2000",
         "Internal logs. Oracle counts bytes not chars.", "XSD + Python"),

        ("SECONDARYDIAGS","(row count)",           "CHECK (COUNT <= 12)",
         "maxOccurs=12",
         "Up to 12 secondary diagnoses per claim", "XSD"),

        ("SECONDARYDIAG", "SecondaryCode",         "VARCHAR2(15) NOT NULL + FK ICD10_MASTER + UNIQUE",
         "minLength=3, maxLength=15, pattern=ICD-10 + duplicate check + != PrimaryCode",
         "Valid ICD-10. No duplicates per claim. Must differ from PrimaryCode. Validated vs CSV.", "XSD + Python"),

        ("SECONDARYDIAG", "Remarks",               "VARCHAR2(2000 BYTE) NOT NULL",
         "maxLength=2000 + UTF-8 byte check",
         "Internal logs. Oracle counts bytes not chars.", "XSD + Python"),

        ("PROCEDURES",    "(row count)",            "CHECK (COUNT <= 20)",
         "minOccurs=0, maxOccurs=20",
         "0 to 20 procedures per claim (optional, depends on case)", "XSD"),

        ("PROCEDURE",     "RvsCode",               "VARCHAR2(6) NOT NULL + FK RVS_MASTER + UNIQUE",
         "minLength=1, maxLength=6 + RVS lookup + duplicate check",
         "Valid RVS code. No duplicates per claim. Validated vs CSV.", "XSD + Python"),

        ("PROCEDURE",     "Laterality",            "VARCHAR2(1) NOT NULL + CHECK IN LIST",
         "enumeration: L, R, B, N",
         "L=Left  R=Right  B=Both  N=None", "XSD"),

        ("PROCEDURE",     "Ext1",                  "NUMBER(1) NOT NULL + CHECK BETWEEN 1 AND 9",
         "pattern=[1-9]",
         "Number of body sites (1-9)", "XSD"),

        ("PROCEDURE",     "Ext2",                  "NUMBER(1) NOT NULL + CHECK BETWEEN 1 AND 9",
         "pattern=[1-9]",
         "Number of times procedure was done (1-9)", "XSD"),

        ("PROCEDURE",     "Remarks",               "VARCHAR2(2000 BYTE) NOT NULL",
         "maxLength=2000 + UTF-8 byte check",
         "Internal logs. Oracle counts bytes not chars.", "XSD + Python"),

        ("BATCH",         "ClaimNumber",           "UNIQUE across all files",
         "Cross-file duplicate detection",
         "Same ClaimNumber in 2+ XML files = UNIQUE violation.", "Python"),
    ]

    for i, row in enumerate(ref_data, start=3):
        bg = C_ODD if i % 2 == 0 else C_EVEN
        ws3.row_dimensions[i].height = 25
        for col, val in enumerate(row, 1):
            dat(ws3, i, col, val, bg=bg)

    wb.save(output_path)
    print(f"\n  [EXCEL] Report saved: {output_path}")


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="CF5 XSD Validator v2.0 — Oracle-style constraint reporting",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Examples:
          python cf5_xsd_validator.py --xml claim.xml --xsd CF5_validated.xsd
                                      --icd ICD10_Case_Rates.csv --rvs RVS_Case_Rates.csv

          python cf5_xsd_validator.py --xml ./batch/ --xsd CF5_validated.xsd
                                      --icd ICD10_Case_Rates.csv --rvs RVS_Case_Rates.csv
                                      --recursive --out report.xlsx
        """)
    )
    parser.add_argument("--xml",       required=True,  help="CF5 XML file or folder")
    parser.add_argument("--xsd",       required=True,  help="Path to CF5_validated.xsd")
    parser.add_argument("--icd",       default=None,   help="ICD10_Case_Rates.csv (optional)")
    parser.add_argument("--rvs",       default=None,   help="RVS_Case_Rates.csv (optional)")
    parser.add_argument("--out",       default=None,   help="Output Excel filename")
    parser.add_argument("--recursive", action="store_true",
                        help="FIX 8: Search subfolders recursively for XML files")
    args = parser.parse_args()

    # Load XSD
    xsd_path = Path(args.xsd)
    if not xsd_path.exists():
        print(f"[ERROR] XSD not found: {xsd_path}"); sys.exit(1)
    try:
        xsd_schema = etree.XMLSchema(etree.parse(str(xsd_path)))
    except Exception as e:
        print(f"[ERROR] Failed to load XSD: {e}"); sys.exit(1)

    # Load ICD-10 master list (FIX 2)
    icd10_codes = set()
    if args.icd:
        icd_path = Path(args.icd)
        if not icd_path.exists():
            print(f"[WARNING] ICD10 CSV not found: {icd_path} — skipping ICD-10 lookup")
        else:
            icd10_codes = load_icd10_codes(str(icd_path))
            print(f"  [INFO] Loaded {len(icd10_codes):,} ICD-10 codes from {icd_path.name}")

    # Load RVS master list (FIX 3)
    rvs_codes = set()
    if args.rvs:
        rvs_path = Path(args.rvs)
        if not rvs_path.exists():
            print(f"[WARNING] RVS CSV not found: {rvs_path} — skipping RVS lookup")
        else:
            rvs_codes = load_rvs_codes(str(rvs_path))
            print(f"  [INFO] Loaded {len(rvs_codes):,} RVS codes from {rvs_path.name}")

    # Collect XML files — FIX 8: recursive support
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

    # FIX 7: Track ClaimNumbers across files for UNIQUE constraint
    seen_claim_numbers = {}  # {claim_number: [file1, file2, ...]}

    # Validate each file
    all_results = []
    for xml_file in xml_files:
        errors = validate_xml_file(xml_file, xsd_schema, icd10_codes, rvs_codes)
        all_results.append({"file": xml_file.name, "errors": errors})

        # Extract ClaimNumber for cross-file uniqueness check
        try:
            doc = etree.parse(str(xml_file))
            drgclaim = doc.getroot().find("DRGCLAIM")
            if drgclaim is not None:
                cn = drgclaim.get("ClaimNumber", "").strip()
                if cn:
                    seen_claim_numbers.setdefault(cn, []).append(xml_file.name)
        except Exception:
            pass

    # Add cross-file duplicate errors to affected files
    dupes = {cn: files for cn, files in seen_claim_numbers.items() if len(files) > 1}
    for cn, files in dupes.items():
        for result in all_results:
            if result["file"] in files:
                result["errors"].append(make_error(
                    result["file"], "N/A", "BATCH", "ClaimNumber", cn,
                    "UNIQUE CONSTRAINT (ClaimNumber across batch)",
                    f"ClaimNumber '{cn}' appears in multiple files: {', '.join(files)}. "
                    f"Oracle UNIQUE constraint violation across batch submission.",
                    "CRITICAL",
                    f"Duplicate ClaimNumber across files: {', '.join(files)}"
                ))

    # Reports
    print_oracle_console_report(all_results, len(xml_files), seen_claim_numbers)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path  = args.out if args.out else f"cf5_validation_report_{timestamp}.xlsx"
    write_excel_report(all_results, out_path, str(xsd_path), seen_claim_numbers)


if __name__ == "__main__":
    main()
