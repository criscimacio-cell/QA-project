#!/usr/bin/env python3
"""
KonSulTa PCB XML Checker
Validates PhilHealth KonSulTa XML files against:
  1. XML well-formedness
  2. DTD structure (KonsultaData_v1.14_1.dtd)
  3. Data Dictionary rules (field formats, valid values, required flags)
  4. Library lookups (Excel reference tables)

Usage:
    python xml_checker.py <xml_file> [options]

Options:
    --dtd <file>        Path to DTD file (default: KonsultaData_v1.14_1.dtd beside this script)
    --libs <dir>        Path to LIBRARIES folder containing .xlsx files
    --report <file>     Write plain-text report to file
    --strict            Treat warnings as errors (exit 1)
    --no-color          Disable ANSI colour output

Exit codes:  0 = pass   1 = errors found   2 = usage / file not found
"""

import argparse
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from io import StringIO

from lxml import etree

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False


# ─────────────────────────────────────────────
# Colour helpers
# ─────────────────────────────────────────────

USE_COLOR = True
_C = {"ERROR": "\033[91m", "WARNING": "\033[93m", "INFO": "\033[96m",
      "PASS": "\033[92m", "BOLD": "\033[1m", "RESET": "\033[0m"}

def c(text, key):
    return f"{_C.get(key,'')}{text}{_C['RESET']}" if USE_COLOR else text

def strip_ansi(s):
    return re.sub(r"\033\[[0-9;]*m", "", s)


# ─────────────────────────────────────────────
# Issue / Result containers
# ─────────────────────────────────────────────

@dataclass
class Issue:
    level:     str        # ERROR | WARNING | INFO
    category:  str        # SYNTAX | DTD | DICT | LIBRARY | TYPE
    message:   str
    line:      int | None = None
    path:      str | None = None

@dataclass
class Result:
    xml_file:  str
    dtd_file:  str | None
    libs_dir:  str | None
    issues:    list = field(default_factory=list)
    passed:    bool = True

    def add(self, level, category, message, line=None, path=None):
        self.issues.append(Issue(level, category, message, line, path))
        if level == "ERROR":
            self.passed = False

    @property
    def errors(self):   return [i for i in self.issues if i.level == "ERROR"]
    @property
    def warnings(self): return [i for i in self.issues if i.level == "WARNING"]


# ─────────────────────────────────────────────
# Library loader
# ─────────────────────────────────────────────

def load_libraries(libs_dir: str) -> dict:
    """
    Returns a dict mapping library name → set of valid string codes.
    Codes come from column 0 (ID/Code column) of each Excel file.
    """
    if not HAS_OPENPYXL:
        print("WARNING: openpyxl not installed – library lookups skipped.", file=sys.stderr)
        return {}

    libs = {}

    mapping = {
        # library key           : (filename,             sheet index, col index)
        "lib_mdiseases":          ("lib_mdiseases.xlsx",         0, 0),
        "lib_icd":                ("lib_icd.xlsx",               0, 0),
        "lib_diagnostic":         ("lib_diagnostic.xlsx",        0, 0),
        "lib_management":         ("lib_management.xlsx",        0, 0),
        "lib_medicine":           ("lib_medicine.xlsx",          0, 0),
        "lib_medicine_generic":   ("lib_medicine_generic.xlsx",  0, 0),
        "lib_medicine_salt":      ("lib_medicine_salt.xlsx",     0, 0),
        "lib_medicine_strength":  ("lib_medicine_strength.xlsx", 0, 0),
        "lib_medicine_form":      ("lib_medicine_form.xlsx",     0, 0),
        "lib_medicine_unit":      ("lib_medicine_unit.xlsx",     0, 0),
        "lib_medicine_package":   ("lib_medicine_package.xlsx",  0, 0),
        "lib_skin_extremities":   ("lib_skin_extremities.xlsx",  0, 0),
        "lib_heent":              ("lib_heent.xlsx",             0, 0),
        "lib_chest":              ("lib_chest.xlsx",             0, 0),
        "lib_heart":              ("lib_heart.xlsx",             0, 0),
        "lib_abdomen":            ("lib_abdomen.xlsx",           0, 0),
        "lib_neuro":              ("lib_neuro.xlsx",             0, 0),
        "lib_digital_rectal":     ("lib_digital_rectal.xlsx",    0, 0),
        "lib_genitourinary":      ("lib_genitourinary.xlsx",     0, 0),
        "lib_immchild":           ("lib_immchild.xlsx",          0, 0),
        "lib_immyoungw":          ("lib_immyoungw.xlsx",         0, 0),
        "lib_immpregw":           ("lib_immpregw.xlsx",          0, 0),
        "lib_immelderly":         ("lib_immelderly.xlsx",        0, 0),
        "lib_signs_symptoms":     ("lib_signs_symptoms.xlsx",    0, 0),
        "lib_chestxray_findings":     ("lib_chestxray_findings.xlsx",     0, 0),
        "lib_chestxray_observation":  ("lib_chestxray_observation.xlsx",  0, 0),
    }

    for lib_key, (filename, sheet_idx, col_idx) in mapping.items():
        path = os.path.join(libs_dir, filename)
        if not os.path.isfile(path):
            continue
        try:
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            ws = wb.worksheets[sheet_idx]
            codes = set()
            for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
                if row and row[col_idx] is not None:
                    raw_code = row[col_idx]
                    # Excel stores integers as floats (1 → 1.0); normalise to int string
                    if isinstance(raw_code, float) and raw_code == int(raw_code):
                        raw_code = int(raw_code)
                    codes.add(str(raw_code).strip())
            libs[lib_key] = codes
        except Exception as e:
            print(f"WARNING: Could not load {filename}: {e}", file=sys.stderr)

    return libs


# ─────────────────────────────────────────────
# Validation helpers
# ─────────────────────────────────────────────

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

def is_date(val):
    if not DATE_RE.match(val):
        return False
    try:
        datetime.strptime(val, "%Y-%m-%d")
        return True
    except ValueError:
        return False

def is_number(val):
    try:
        float(val)
        return True
    except ValueError:
        return False

def check_length(val, max_bytes):
    return len(val.encode("utf-8")) <= max_bytes

def lib_lookup(val, lib_name, libs, allow_semicolon=False):
    """Return list of codes that are NOT in the library."""
    if lib_name not in libs:
        return []    # library not loaded – skip
    if not val or not val.strip():
        return []
    codes = [v.strip() for v in val.split(";")] if allow_semicolon else [val.strip()]
    return [code for code in codes if code and code not in libs[lib_name]]


# ─────────────────────────────────────────────
# Element-level rule definitions
# ─────────────────────────────────────────────
# Each rule is (attribute, max_bytes, required_flag, valid_values_set_or_None,
#               date_flag, number_flag, lib_key_or_None, multi_value_flag)
# required_flag: True = always required; None = defined as REQUIRED in DTD but
#                we skip (DTD already catches it); False = optional per data dict

REPORT_STATUS_VALS = {"U", "V", "F"}
YN_VALS      = {"Y", "N"}
YNX_VALS     = {"Y", "N", "X"}
YNBLANK_VALS = {"Y", "N", ""}
SEX_VALS     = {"M", "F"}
MMDD_VALS    = {"MM", "DD"}
PKG_VALS     = {"P", "E", "K"}
UVF_VALS     = {"U", "V", "F"}
LAB_STATUS   = {"D", "N", "X", "W"}


def _r(attr, max_b=None, vals=None, date=False, num=False, lib=None, multi=False):
    return (attr, max_b, vals, date, num, lib, multi)


# Rules per element — every attribute from the data dictionary is listed.
# Format: _r(attribute, max_bytes, valid_values_set, date, numeric, lib_key, multi_semicolon)
RULES: dict[str, list] = {

    # ── PCB (root) ──────────────────────────────────────────────────
    "PCB": [
        _r("pUsername",              21),
        _r("pPassword",              21),
        _r("pHciAccreNo",            21),
        _r("pPMCCNo",                21),
        _r("pEnlistTotalCnt",        None, num=True),
        _r("pProfileTotalCnt",       None, num=True),
        _r("pSoapTotalCnt",          None, num=True),
        _r("pCertificationId",       21),
        _r("pHciTransmittalNumber",  21),
    ],

    # ── ENLISTMENT ──────────────────────────────────────────────────
    "ENLISTMENT": [
        _r("pHciCaseNo",             21),
        _r("pHciTransNo",            21),
        _r("pEffYear",                4),
        _r("pEnlistStat",             1, {"1","2","3"}),
        _r("pEnlistDate",            10, date=True),
        _r("pPackageType",            1, PKG_VALS),
        _r("pMemPin",                12),
        _r("pMemFname",              30),
        _r("pMemMname",              30),
        _r("pMemLname",              30),
        _r("pMemExtname",            30),
        _r("pMemDob",                10, date=True),
        _r("pPatientPin",            12),
        _r("pPatientFname",          30),
        _r("pPatientMname",          30),
        _r("pPatientLname",          30),
        _r("pPatientExtname",        30),
        _r("pPatientSex",             1, SEX_VALS),
        _r("pPatientDob",            10, date=True),
        _r("pPatientType",            2, MMDD_VALS),
        _r("pPatientMobileNo",       15),
        _r("pPatientLandlineNo",     15),
        _r("pWithConsent",            1, YNX_VALS),
        _r("pTransDate",             10, date=True),
        _r("pCreatedBy",             30),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── PROFILE ─────────────────────────────────────────────────────
    "PROFILE": [
        _r("pHciTransNo",            21),
        _r("pHciCaseNo",             21),
        _r("pProfDate",              10, date=True),
        _r("pPatientPin",            12),
        _r("pPatientType",            2, MMDD_VALS),
        _r("pPatientAge",            21),
        _r("pMemPin",                12),
        _r("pEffYear",                4),
        _r("pATC",                   10),
        _r("pIsWalkedIn",             1, YN_VALS),
        _r("pTransDate",             10, date=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "MEDHIST": [
        _r("pMdiseaseCode",           3, lib="lib_mdiseases"),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "MHSPECIFIC": [
        _r("pMdiseaseCode",           3, lib="lib_mdiseases"),
        _r("pSpecificDesc",        2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "SURGHIST": [
        _r("pSurgDesc",             500),
        _r("pSurgDate",              10, date=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "FAMHIST": [
        _r("pMdiseaseCode",           3, lib="lib_mdiseases"),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "FHSPECIFIC": [
        _r("pMdiseaseCode",           3, lib="lib_mdiseases"),
        _r("pSpecificDesc",        2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "SOCHIST": [
        _r("pIsSmoker",               1, YNX_VALS),
        _r("pNoCigpk",             None, num=True),
        _r("pIsAdrinker",             1, YNX_VALS),
        _r("pNoBottles",           None, num=True),
        _r("pIllDrugUser",            1, YNX_VALS),
        _r("pIsSexuallyActive",       1, YNX_VALS),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "IMMUNIZATION": [
        _r("pChildImmcode",        None, lib="lib_immchild",  multi=True),
        _r("pYoungwImmcode",       None, lib="lib_immyoungw", multi=True),
        _r("pPregwImmcode",        None, lib="lib_immpregw",  multi=True),
        _r("pElderlyImmcode",      None, lib="lib_immelderly",multi=True),
        _r("pOtherImm",            2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "MENSHIST": [
        _r("pMenarchePeriod",      None, num=True),
        _r("pLastMensPeriod",        10, date=True),
        _r("pPeriodDuration",      None, num=True),
        _r("pMensInterval",        None, num=True),
        _r("pPadsPerDay",          None, num=True),
        _r("pOnsetSexIc",          None, num=True),
        _r("pBirthCtrlMethod",     2000),
        _r("pIsMenopause",            1, YN_VALS),
        _r("pMenopauseAge",        None, num=True),
        _r("pIsApplicable",           1, YN_VALS),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "PREGHIST": [
        _r("pPregCnt",             None, num=True),
        _r("pDeliveryCnt",         None, num=True),
        _r("pDeliveryTyp",            1, {"N","O","B","X"}),
        _r("pFullTermCnt",         None, num=True),
        _r("pPrematureCnt",        None, num=True),
        _r("pAbortionCnt",         None, num=True),
        _r("pLivChildrenCnt",      None, num=True),
        _r("pWPregIndhyp",            1, YN_VALS),
        _r("pWFamPlan",               1, YN_VALS),
        _r("pIsApplicable",           1, YN_VALS),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "BLOODTYPE": [
        _r("pBloodType",              3, {"A+","B+","AB+","O+","A-","B-","AB-","O-",""}),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "PEGENSURVEY": [
        _r("pGenSurveyId",            1, {"1","2"}),
        _r("pGenSurveyRem",        2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "PEMISC": [
        _r("pSkinId",                 3, lib="lib_skin_extremities"),
        _r("pHeentId",                3, lib="lib_heent"),
        _r("pChestId",                3, lib="lib_chest"),
        _r("pHeartId",                3, lib="lib_heart"),
        _r("pAbdomenId",              3, lib="lib_abdomen"),
        _r("pNeuroId",                3, lib="lib_neuro"),
        _r("pRectalId",               3, lib="lib_digital_rectal"),
        _r("pGuId",                   3, lib="lib_genitourinary"),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "PESPECIFIC": [
        _r("pSkinRem",             2000),
        _r("pHeentRem",            2000),
        _r("pChestRem",            2000),
        _r("pHeartRem",            2000),
        _r("pAbdomenRem",          2000),
        _r("pNeuroRem",            2000),
        _r("pRectalRem",           2000),
        _r("pGuRem",               2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "NCDQANS": [
        _r("pQid1_Yn",               1, YN_VALS),
        _r("pQid2_Yn",               1, YN_VALS),
        _r("pQid3_Yn",               1, YN_VALS),
        _r("pQid4_Yn",               1, YN_VALS),
        _r("pQid5_Ynx",              1, {"Y","N","X"}),
        _r("pQid6_Yn",               1, YN_VALS),
        _r("pQid7_Yn",               1, YN_VALS),
        _r("pQid8_Yn",               1, YN_VALS),
        _r("pQid9_Yn",               1, YN_VALS),
        _r("pQid10_Yn",              1, YN_VALS),
        _r("pQid11_Yn",              1, YN_VALS),
        _r("pQid12_Yn",              1, YN_VALS),
        _r("pQid13_Yn",              1, YN_VALS),
        _r("pQid14_Yn",              1, YN_VALS),
        _r("pQid15_Yn",              1, YN_VALS),
        _r("pQid16_Yn",              1, YN_VALS),
        _r("pQid17_Abcde",           1, {"A","B","C","D","E"}),
        _r("pQid18_Yn",              1, YN_VALS),
        _r("pQid19_Yn",              1, YN_VALS),
        _r("pQid19_Fbsmg",          50),
        _r("pQid19_Fbsmmol",        50),
        _r("pQid19_Fbsdate",        10, date=True),
        _r("pQid20_Yn",              1, YN_VALS),
        _r("pQid20_Choleval",       50),
        _r("pQid20_Choledate",      10, date=True),
        _r("pQid21_Yn",              1, YN_VALS),
        _r("pQid21_Ketonval",       50),
        _r("pQid21_Ketondate",      10, date=True),
        _r("pQid22_Yn",              1, YN_VALS),
        _r("pQid22_Proteinval",     50),
        _r("pQid22_Proteindate",    10, date=True),
        _r("pQid23_Yn",              1, YN_VALS),
        _r("pQid24_Yn",              1, YN_VALS),
        _r("pReportStatus",          1, UVF_VALS),
        _r("pDeficiencyRemarks",  2000),
    ],

    # ── SOAP ─────────────────────────────────────────────────────────
    "SOAP": [
        _r("pHciCaseNo",             21),
        _r("pHciTransNo",            21),
        _r("pSoapDate",              10, date=True),
        _r("pPatientPin",            12),
        _r("pPatientType",            2, MMDD_VALS),
        _r("pMemPin",                12),
        _r("pEffYear",                4),
        _r("pATC",                   10),
        _r("pIsWalkedIn",             1, YN_VALS),
        _r("pCoPay",                 15),
        _r("pTransDate",             10, date=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "SUBJECTIVE": [
        _r("pIllnessHistory",      2000),
        _r("pSignsSymptoms",       2000, lib="lib_signs_symptoms", multi=True),
        _r("pOtherComplaint",      2000),
        _r("pPainSite",             500),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "PEPERT": [
        _r("pSystolic",            None, num=True),
        _r("pDiastolic",           None, num=True),
        _r("pHr",                  None, num=True),
        _r("pRr",                  None, num=True),
        _r("pTemp",                None, num=True),
        _r("pHeight",              None, num=True),
        _r("pWeight",              None, num=True),
        _r("pBMI",                 None, num=True),
        _r("pZScore",                10),
        _r("pLeftVision",            12),
        _r("pRightVision",           12),
        _r("pLength",              None, num=True),
        _r("pHeadCirc",            None, num=True),
        _r("pSkinfoldThickness",   None, num=True),
        _r("pWaist",               None, num=True),
        _r("pHip",                 None, num=True),
        _r("pLimbs",               None, num=True),
        _r("pMidUpperArmCirc",     None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "ICD": [
        _r("pIcdCode",               10, lib="lib_icd"),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "DIAGNOSTIC": [
        _r("pDiagnosticId",           3, lib="lib_diagnostic"),
        _r("pOthRemarks",           500),
        _r("pIsPhysicianRecommendation", 1, {"Y","N","X"}),
        _r("pPatientRemarks",         2, {"RQ","RF","XX"}),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "MANAGEMENT": [
        _r("pManagementId",        None, lib="lib_management"),
        _r("pOthRemarks",           500),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    "ADVICE": [
        _r("pRemarks",             2000),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── MEDICINE ─────────────────────────────────────────────────────
    "MEDICINE": [
        _r("pHciCaseNo",             21),
        _r("pHciTransNo",            21),
        _r("pCategory",              50, {"NCD","ANTIBIOTIC","OTHERS","-",""}),
        _r("pDrugCode",              30, lib="lib_medicine"),
        _r("pGenericCode",            5, lib="lib_medicine_generic"),
        _r("pSaltCode",               5, lib="lib_medicine_salt"),
        _r("pStrengthCode",           5, lib="lib_medicine_strength"),
        _r("pFormCode",               5, lib="lib_medicine_form"),
        _r("pUnitCode",               5, lib="lib_medicine_unit"),
        _r("pPackageCode",            5, lib="lib_medicine_package"),
        _r("pOtherMedicine",        500),
        _r("pOthMedDrugGrouping",    50),
        _r("pRoute",                500),
        _r("pQuantity",            None, num=True),
        _r("pActualUnitPrice",     None, num=True),
        _r("pTotalAmtPrice",       None, num=True),
        _r("pInstructionQuantity",   50),
        _r("pInstructionStrength",   50),
        _r("pInstructionFrequency",  50),
        _r("pPrescribingPhysician", 200),
        _r("pIsDispensed",            1, YN_VALS),
        _r("pDateDispensed",         10, date=True),
        _r("pDispensingPersonnel",  200),
        _r("pIsApplicable",           1, YN_VALS),
        _r("pDateAdded",             10, date=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── DIAGNOSTICEXAMRESULT header ──────────────────────────────────
    "DIAGNOSTICEXAMRESULT": [
        _r("pHciCaseNo",             21),
        _r("pHciTransNo",            21),
        _r("pPatientPin",            12),
        _r("pPatientType",            2, MMDD_VALS),
        _r("pMemPin",                12),
        _r("pEffYear",                4),
    ],

    # ── Lab result shared fields helper (reused below) ───────────────
    # ── CBC ──────────────────────────────────────────────────────────
    "CBC": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pHematocrit",            50),
        _r("pHemoglobinG",           50),
        _r("pHemoglobinMmol",        50),
        _r("pMhcPg",                 50),
        _r("pMhcFmol",               50),
        _r("pMchcGhb",               50),
        _r("pMchcMmol",              50),
        _r("pMcvUm",                 50),
        _r("pMcvFl",                 50),
        _r("pWbc1000",               50),
        _r("pWbc10",                 50),
        _r("pMyelocyte",             50),
        _r("pNeutrophilsBnd",        50),
        _r("pNeutrophilsSeg",        50),
        _r("pLymphocytes",           50),
        _r("pMonocytes",             50),
        _r("pEosinophils",           50),
        _r("pBasophils",             50),
        _r("pPlatelet",              50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── URINALYSIS ───────────────────────────────────────────────────
    "URINALYSIS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pGravity",               50),
        _r("pAppearance",            50),
        _r("pColor",                 50),
        _r("pGlucose",               50),
        _r("pProteins",              50),
        _r("pKetones",               50),
        _r("pPh",                    50),
        _r("pRbCells",               50),
        _r("pWbCells",               50),
        _r("pBacteria",              50),
        _r("pCrystals",              50),
        _r("pBladderCell",           50),
        _r("pSquamousCell",          50),
        _r("pTubularCell",           50),
        _r("pBroadCasts",            50),
        _r("pEpithelialCast",        50),
        _r("pGranularCast",          50),
        _r("pHyalineCast",           50),
        _r("pRbcCast",               50),
        _r("pWaxyCast",              50),
        _r("pWcCast",                50),
        _r("pAlbumin",               50),
        _r("pPusCells",              50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── CHESTXRAY ────────────────────────────────────────────────────
    "CHESTXRAY": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            None, lib="lib_chestxray_findings"),
        _r("pRemarksFindings",     2000),
        _r("pObservation",         None, lib="lib_chestxray_observation"),
        _r("pRemarksObservation",  2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── SPUTUM ───────────────────────────────────────────────────────
    "SPUTUM": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pDataCollection",      None, {"S1","S2","S3",""}),
        _r("pFindings",            None, {"P","N",""}),
        _r("pRemarks",             2000),
        _r("pNoPlusses",             50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── LIPIDPROFILE ─────────────────────────────────────────────────
    "LIPIDPROFILE": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pLdl",                   50),
        _r("pHdl",                   50),
        _r("pTotal",                 50),
        _r("pCholesterol",           50),
        _r("pTriglycerides",         50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FBS ──────────────────────────────────────────────────────────
    "FBS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pGlucoseMg",             50),
        _r("pGlucoseMmol",           50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── RBS ──────────────────────────────────────────────────────────
    "RBS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pGlucoseMg",             50),
        _r("pGlucoseMmol",           50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── ECG ──────────────────────────────────────────────────────────
    "ECG": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pRemarks",             2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FECALYSIS ────────────────────────────────────────────────────
    "FECALYSIS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pColor",                 50),
        _r("pConsistency",           50),
        _r("pRbc",                   50),
        _r("pWbc",                   50),
        _r("pOva",                   50),
        _r("pParasite",              50),
        _r("pBlood",                 50),
        _r("pPusCells",              50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── PAPSMEAR ─────────────────────────────────────────────────────
    "PAPSMEAR": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pImpression",          2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── OGTT ─────────────────────────────────────────────────────────
    "OGTT": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pExamFastingMg",         50),
        _r("pExamFastingMmol",       50),
        _r("pExamOgttOneHrMg",       50),
        _r("pExamOgttOneHrMmol",     50),
        _r("pExamOgttTwoHrMg",       50),
        _r("pExamOgttTwoHrMmol",     50),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FOBT ─────────────────────────────────────────────────────────
    "FOBT": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── CREATININE ───────────────────────────────────────────────────
    "CREATININE": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── PPDTest ──────────────────────────────────────────────────────
    "PPDTest": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── HbA1c ────────────────────────────────────────────────────────
    "HbA1c": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── OTHERDIAGEXAM ────────────────────────────────────────────────
    "OTHERDIAGEXAM": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True),
        _r("pOthDiagExam",         2000),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── DOCUMENT ─────────────────────────────────────────────────────
    "DOCUMENT": [
        _r("pHciCaseNo",             21),
        _r("pHciTransNo",            21),
        _r("pPatientPin",            12),
        _r("pPatientType",            2, MMDD_VALS),
        _r("pMemPin",                12),
        _r("pDocumentType",          50),
        _r("pDocumentUrl",         2000),
        _r("pTransDate",             10, date=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],
}


# ─────────────────────────────────────────────
# Validation steps
# ─────────────────────────────────────────────

def check_syntax(xml_path, result) -> etree._Element | None:
    try:
        parser = etree.XMLParser(load_dtd=True, no_network=True, resolve_entities=False)
        tree = etree.parse(xml_path, parser=parser)
        result.add("INFO", "SYNTAX", "XML is well-formed")
        return tree.getroot()
    except etree.XMLSyntaxError as exc:
        for err in exc.error_log:
            result.add("ERROR", "SYNTAX", err.message, line=err.line)
        return None


def check_dtd(xml_path, dtd_path, result):
    try:
        dtd = etree.DTD(dtd_path)
    except etree.DTDParseError as exc:
        result.add("ERROR", "DTD", f"Cannot parse DTD: {exc}")
        return
    try:
        tree = etree.parse(xml_path)
    except etree.XMLSyntaxError:
        return
    if dtd.validate(tree):
        result.add("INFO", "DTD", f"Document is valid against DTD: {os.path.basename(dtd_path)}")
    else:
        for err in dtd.error_log:
            result.add("ERROR", "DTD", err.message, line=err.line)


def check_data_dict(root: etree._Element, libs: dict, result: Result):
    def walk(elem, path):
        tag  = elem.tag
        line = getattr(elem, "sourceline", None)
        rules = RULES.get(tag)

        if rules is None:
            # not an element we define rules for — skip silently
            for child in elem:
                walk(child, f"{path}/{child.tag}")
            return

        for (attr, max_b, vals, date_flag, num_flag, lib_key, multi) in rules:
            raw = elem.get(attr)
            if raw is None:
                continue          # missing required attrs caught by DTD
            val = raw.strip()

            # ── valid values set ─────────────────────────────────────
            if vals and val not in vals and val != "":
                result.add("ERROR", "DICT",
                    f"<{tag}> @{attr}='{val}' not in allowed values {sorted(vals)}",
                    line=line, path=path)

            # ── date format ──────────────────────────────────────────
            if date_flag and val and not is_date(val):
                result.add("ERROR", "TYPE",
                    f"<{tag}> @{attr}='{val}' is not a valid date (expected YYYY-MM-DD)",
                    line=line, path=path)

            # ── numeric check ────────────────────────────────────────
            if num_flag and val and not is_number(val):
                result.add("WARNING", "TYPE",
                    f"<{tag}> @{attr}='{val}' is not numeric",
                    line=line, path=path)

            # ── field length ─────────────────────────────────────────
            if max_b and val and not check_length(val, max_b):
                result.add("WARNING", "DICT",
                    f"<{tag}> @{attr} value exceeds {max_b}-byte limit "
                    f"({len(val.encode())} bytes)",
                    line=line, path=path)

            # ── library lookup ───────────────────────────────────────
            if lib_key and val:
                bad = lib_lookup(val, lib_key, libs, allow_semicolon=multi)
                for code in bad:
                    result.add("ERROR", "LIBRARY",
                        f"<{tag}> @{attr}='{code}' not found in {lib_key}",
                        line=line, path=path)

        for child in elem:
            walk(child, f"{path}/{child.tag}")

    walk(root, root.tag)


# ─────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────

def build_report(result: Result, strict: bool) -> str:
    out = StringIO()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    out.write(f"\n{'='*70}\n")
    out.write(f"  KONSULTA PCB XML CHECKER\n")
    out.write(f"  Generated : {ts}\n")
    out.write(f"  File      : {result.xml_file}\n")
    if result.dtd_file:
        out.write(f"  DTD       : {result.dtd_file}\n")
    if result.libs_dir:
        out.write(f"  Libraries : {result.libs_dir}\n")
    out.write(f"{'='*70}\n\n")

    by_cat: dict[str, list[Issue]] = {}
    for issue in result.issues:
        by_cat.setdefault(issue.category, []).append(issue)

    for cat, issues in by_cat.items():
        out.write(f"  [{cat}]\n")
        for i in issues:
            lvl = c(f"  {i.level:<8}", i.level)
            loc = f"  line {i.line}" if i.line else ""
            pth = f"  @ {i.path}" if i.path else ""
            out.write(f"{lvl} {i.message}{loc}{pth}\n")
        out.write("\n")

    errors   = len(result.errors)
    warnings = len(result.warnings)
    fail = not result.passed or (strict and warnings > 0)

    out.write(f"{'─'*70}\n")
    out.write(f"  Errors: {c(str(errors),'ERROR')}   Warnings: {c(str(warnings),'WARNING')}\n")
    if fail:
        out.write(f"\n  {c('✘  VALIDATION FAILED','ERROR')}\n")
    else:
        out.write(f"\n  {c('✔  ALL CHECKS PASSED','PASS')}\n")
    out.write(f"{'='*70}\n\n")
    return out.getvalue()


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────

def parse_args():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_dtd  = os.path.join(script_dir, "KonsultaData_v1.14_1.dtd")
    default_libs = os.path.join(script_dir, "LIBRARIES")

    p = argparse.ArgumentParser(
        description="Validate a KonSulTa PCB XML file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("xml_file", help="Path to the XML file to check")
    p.add_argument("--dtd",    default=default_dtd,  metavar="FILE",
                   help=f"DTD file (default: {default_dtd})")
    p.add_argument("--libs",   default=default_libs, metavar="DIR",
                   help=f"Libraries folder (default: {default_libs})")
    p.add_argument("--report", metavar="FILE", help="Write report to file")
    p.add_argument("--strict", action="store_true",
                   help="Warnings count as errors")
    p.add_argument("--no-color", action="store_true",
                   help="Disable coloured output")
    return p.parse_args()


def main() -> int:
    global USE_COLOR
    args = parse_args()

    if args.no_color:
        USE_COLOR = False

    if not os.path.isfile(args.xml_file):
        print(f"Error: XML file not found: {args.xml_file}", file=sys.stderr)
        return 2

    dtd_path  = args.dtd  if os.path.isfile(args.dtd)   else None
    libs_dir  = args.libs if os.path.isdir(args.libs)   else None

    if not dtd_path:
        print(f"WARNING: DTD not found at {args.dtd} – DTD check skipped.", file=sys.stderr)
    if not libs_dir:
        print(f"WARNING: LIBRARIES folder not found at {args.libs} – library checks skipped.",
              file=sys.stderr)

    result = Result(xml_file=args.xml_file, dtd_file=dtd_path, libs_dir=libs_dir)

    # 1 – Well-formedness
    root = check_syntax(args.xml_file, result)

    # 2 – DTD
    if dtd_path and root is not None:
        check_dtd(args.xml_file, dtd_path, result)

    # 3 – Data dictionary + library lookups
    if root is not None:
        libs = load_libraries(libs_dir) if libs_dir else {}
        check_data_dict(root, libs, result)

    report = build_report(result, strict=args.strict)

    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(strip_ansi(report))
        print(f"Report written to: {args.report}")
    else:
        print(report)

    fail = not result.passed or (args.strict and len(result.warnings) > 0)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
