"""
core_checker.py
Shared validation engine for PhilHealth KonSulTa XML checkers.
Imported by fpe_xml_checker.py (first tranche) and spe_xml_checker.py (second tranche).
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

def load_libraries(libs_dir: str) -> tuple[dict, list[str]]:
    """
    Returns (libs, missing) where:
      libs    = dict mapping library name -> set of valid string codes
                Codes come from column 0 (ID/Code column) of each Excel file.
      missing = list of expected filenames that were not found in libs_dir.
                Any attribute whose lib_key is in `missing` was NOT checked
                against a code list -- its values were accepted unverified.
    """
    if not HAS_OPENPYXL:
        print("WARNING: openpyxl not installed – library lookups skipped.", file=sys.stderr)
        return {}, []

    libs = {}
    missing = []

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
            missing.append(filename)
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
            missing.append(filename)
            print(f"WARNING: Could not load {filename}: {e}", file=sys.stderr)

    return libs, missing


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


def _r(attr, max_b=None, vals=None, date=False, num=False, lib=None, multi=False, req=False):
    return (attr, max_b, vals, date, num, lib, multi, req)


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
        _r("pCategory",              50),
        _r("pDrugCode",              30, lib="lib_medicine"),
        _r("pGenericCode",            5, lib="lib_medicine_generic"),
        _r("pSaltCode",               5, lib="lib_medicine_salt"),
        _r("pStrengthCode",           5, lib="lib_medicine_strength"),
        _r("pFormCode",               5, lib="lib_medicine_form"),
        _r("pUnitCode",               5, lib="lib_medicine_unit"),
        _r("pPackageCode",            5, lib="lib_medicine_package"),
        _r("pOtherMedicine",        500),
        _r("pOthMedDrugGrouping",    50, {"NCD","ANTIBIOTIC","OTHERS"}),
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
        _r("pDateAdded",             10, date=True, req="cond"),
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
        _r("pLabDate",               10, date=True, req=True),
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
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── URINALYSIS ───────────────────────────────────────────────────
    "URINALYSIS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
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
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── CHESTXRAY ────────────────────────────────────────────────────
    "CHESTXRAY": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",            None, lib="lib_chestxray_findings"),
        _r("pRemarksFindings",     2000),
        _r("pObservation",         None, lib="lib_chestxray_observation"),
        _r("pRemarksObservation",  2000),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── SPUTUM ───────────────────────────────────────────────────────
    "SPUTUM": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pDataCollection",         1, {"1","2","3","X"}),
        _r("pFindings",               1, {"1","2"}, num=True),
        _r("pRemarks",             2000),
        _r("pNoPlusses",             50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── LIPIDPROFILE ─────────────────────────────────────────────────
    "LIPIDPROFILE": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pLdl",                   50),
        _r("pHdl",                   50),
        _r("pTotal",                 50),
        _r("pCholesterol",           50),
        _r("pTriglycerides",         50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FBS ──────────────────────────────────────────────────────────
    "FBS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pGlucoseMg",             50),
        _r("pGlucoseMmol",           50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── RBS ──────────────────────────────────────────────────────────
    "RBS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pGlucoseMg",             50),
        _r("pGlucoseMmol",           50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── ECG ──────────────────────────────────────────────────────────
    "ECG": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",            2000),
        _r("pRemarks",             2000),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FECALYSIS ────────────────────────────────────────────────────
    "FECALYSIS": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pColor",                 50, {"1","2","3","4","5","6"}, num=True),
        _r("pConsistency",           50, {"1","2","3","4","5","6"}, num=True),
        _r("pRbc",                   50),
        _r("pWbc",                   50),
        _r("pOva",                   50),
        _r("pParasite",              50),
        _r("pBlood",                 50, {"P","A"}),
        _r("pPusCells",              50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── PAPSMEAR ─────────────────────────────────────────────────────
    "PAPSMEAR": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",            2000),
        _r("pImpression",          2000),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── OGTT ─────────────────────────────────────────────────────────
    "OGTT": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pExamFastingMg",         50),
        _r("pExamFastingMmol",       50),
        _r("pExamOgttOneHrMg",       50),
        _r("pExamOgttOneHrMmol",     50),
        _r("pExamOgttTwoHrMg",       50),
        _r("pExamOgttTwoHrMmol",     50),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── FOBT ─────────────────────────────────────────────────────────
    "FOBT": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",               1, {"P","N"}),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── CREATININE ───────────────────────────────────────────────────
    "CREATININE": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── PPDTest ──────────────────────────────────────────────────────
    "PPDTest": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",               1, {"P","N"}),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── HbA1c ────────────────────────────────────────────────────────
    "HbA1c": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True, req=True),
        _r("pStatus",                 1, LAB_STATUS),
        _r("pDiagnosticLabFee",    None, num=True),
        _r("pReportStatus",           1, UVF_VALS),
        _r("pDeficiencyRemarks",   2000),
    ],

    # ── OTHERDIAGEXAM ────────────────────────────────────────────────
    "OTHERDIAGEXAM": [
        _r("pReferralFacility",    1000),
        _r("pLabDate",               10, date=True, req=True),
        _r("pOthDiagExam",         2000),
        _r("pFindings",            2000),
        _r("pDateAdded",             10, date=True, req=True),
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
            if elem.attrib:
                result.add("WARNING", "DICT",
                    f"<{tag}> is not a recognised element — attribute checks skipped",
                    line=line, path=path)
            for child in elem:
                walk(child, f"{path}/{child.tag}")
            return

        for (attr, max_b, vals, date_flag, num_flag, lib_key, multi, req_flag) in rules:
            raw = elem.get(attr)
            if raw is None:
                continue          # missing required attrs caught by DTD
            val = raw.strip()

            # ── required (must not be blank) ─────────────────────────
            if req_flag is True and not val:
                result.add("ERROR", "DICT",
                    f"<{tag}> @{attr} is required and must not be blank",
                    line=line, path=path)
            elif req_flag == "cond" and not val:
                # required only when the element has at least one other filled attribute
                other_vals = [v for k, v in elem.attrib.items() if k != attr and v.strip()]
                if other_vals:
                    result.add("ERROR", "DICT",
                        f"<{tag}> @{attr} is required and must not be blank when medicine data is present",
                        line=line, path=path)

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
                result.add("ERROR", "TYPE",
                    f"<{tag}> @{attr}='{val}' is not numeric",
                    line=line, path=path)

            # ── field length ─────────────────────────────────────────
            if max_b and val and not check_length(val, max_b):
                result.add("ERROR", "DICT",
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
# Cross-field rules
# ─────────────────────────────────────────────

def _get(elem, attr):
    """Return stripped attribute value or empty string."""
    return (elem.get(attr) or "").strip()


def check_cross_field(root: etree._Element, result: Result):
    """
    Validate rules that depend on the value of another attribute.
    All rules come directly from the KonSulTa data dictionary Rev 14.
    """

    # ── helper ──────────────────────────────────────────────────────
    def req_if(elem, trigger_attr, trigger_vals, dependent_attr, tag=None, line=None):
        """Warn if trigger is active but dependent field is empty."""
        tag  = tag  or elem.tag
        line = line or getattr(elem, "sourceline", None)
        tv   = _get(elem, trigger_attr)
        dv   = _get(elem, dependent_attr)
        if tv in trigger_vals and not dv:
            result.add("ERROR", "CROSS",
                f"<{tag}> @{dependent_attr} is required when "
                f"@{trigger_attr}='{tv}'",
                line=line)

    def must_equal_if(elem, trigger_attr, trigger_val, dependent_attr, expected_val,
                      tag=None, line=None):
        """Warn if trigger is active but dependent field has wrong value."""
        tag  = tag  or elem.tag
        line = line or getattr(elem, "sourceline", None)
        tv   = _get(elem, trigger_attr)
        dv   = _get(elem, dependent_attr)
        if tv == trigger_val and dv and dv != expected_val:
            result.add("WARNING", "CROSS",
                f"<{tag}> @{dependent_attr} should be '{expected_val}' "
                f"when @{trigger_attr}='{trigger_val}' (got '{dv}')",
                line=line)

    def contains_code(semicolon_val, code):
        return code in {v.strip() for v in semicolon_val.split(";")}

    # ── Collect family history disease codes for the Diabetes rule ───
    fh_diabetes = set()   # pHciCaseNo values whose FAMHIST has DM code 006
    for fh in root.iter("FAMHIST"):
        if _get(fh, "pMdiseaseCode") == "006":
            # walk up to find the PROFILE's pHciCaseNo
            profile = fh.getparent()
            while profile is not None and profile.tag != "PROFILE":
                profile = profile.getparent()
            if profile is not None:
                fh_diabetes.add(_get(profile, "pHciCaseNo"))

    # ══════════════════════════════════════════════════════════════════
    # SOCHIST rules
    # ══════════════════════════════════════════════════════════════════
    for elem in root.iter("SOCHIST"):
        line = getattr(elem, "sourceline", None)

        # pNoCigpk required if pIsSmoker = 'Y'
        req_if(elem, "pIsSmoker",   {"Y"}, "pNoCigpk",  line=line)
        # pNoBottles required if pIsAdrinker = 'Y'
        req_if(elem, "pIsAdrinker", {"Y"}, "pNoBottles", line=line)

    # ══════════════════════════════════════════════════════════════════
    # PEGENSURVEY — pGenSurveyRem required if pGenSurveyId = '2'
    # ══════════════════════════════════════════════════════════════════
    for elem in root.iter("PEGENSURVEY"):
        req_if(elem, "pGenSurveyId", {"2"}, "pGenSurveyRem")

    # ══════════════════════════════════════════════════════════════════
    # PROFILE / SOAP — pATC must be 'WALKEDIN' when pIsWalkedIn = 'Y'
    # ══════════════════════════════════════════════════════════════════
    for tag in ("PROFILE", "SOAP"):
        for elem in root.iter(tag):
            must_equal_if(elem, "pIsWalkedIn", "Y", "pATC", "WALKEDIN")

    # ══════════════════════════════════════════════════════════════════
    # SUBJECTIVE cross-field rules
    # ══════════════════════════════════════════════════════════════════
    for elem in root.iter("SUBJECTIVE"):
        line = getattr(elem, "sourceline", None)
        signs = _get(elem, "pSignsSymptoms")

        # pOtherComplaint required if 'X' code is in pSignsSymptoms
        if contains_code(signs, "X") and not _get(elem, "pOtherComplaint"):
            result.add("ERROR", "CROSS",
                "<SUBJECTIVE> @pOtherComplaint is required when 'X' "
                "is included in @pSignsSymptoms",
                line=line)

        # pPainSite required if pain code '38' is in pSignsSymptoms
        if contains_code(signs, "38") and not _get(elem, "pPainSite"):
            result.add("ERROR", "CROSS",
                "<SUBJECTIVE> @pPainSite is required when pain code '38' "
                "is included in @pSignsSymptoms",
                line=line)

    # ══════════════════════════════════════════════════════════════════
    # MEDICINE cross-field rules
    # ══════════════════════════════════════════════════════════════════
    for elem in root.iter("MEDICINE"):
        line = getattr(elem, "sourceline", None)

        # pOthMedDrugGrouping required if pOtherMedicine has value AND pIsApplicable='Y'
        if _get(elem, "pOtherMedicine") and _get(elem, "pIsApplicable") == "Y":
            if not _get(elem, "pOthMedDrugGrouping"):
                result.add("ERROR", "CROSS",
                    "<MEDICINE> @pOthMedDrugGrouping is required when "
                    "@pOtherMedicine has a value and @pIsApplicable='Y'",
                    line=line)

        # pDateDispensed required if pIsDispensed = 'Y'
        req_if(elem, "pIsDispensed", {"Y"}, "pDateDispensed", line=line)

    # ══════════════════════════════════════════════════════════════════
    # NCDQANS — sub-field groups required when parent question = 'Y'
    # ══════════════════════════════════════════════════════════════════
    for elem in root.iter("NCDQANS"):
        line = getattr(elem, "sourceline", None)

        # Q19: Have you had FBS/RBS done? → require value + date
        for dep in ("pQid19_Fbsmg", "pQid19_Fbsmmol", "pQid19_Fbsdate"):
            req_if(elem, "pQid19_Yn", {"Y"}, dep, line=line)

        # Q20: Have you had Cholesterol test? → require value + date
        for dep in ("pQid20_Choleval", "pQid20_Choledate"):
            req_if(elem, "pQid20_Yn", {"Y"}, dep, line=line)

        # Q21: Have you had Urine Ketones test? → require value + date
        for dep in ("pQid21_Ketonval", "pQid21_Ketondate"):
            req_if(elem, "pQid21_Yn", {"Y"}, dep, line=line)

        # Q22: Have you had Urine Protein test? → require value + date
        for dep in ("pQid22_Proteinval", "pQid22_Proteindate"):
            req_if(elem, "pQid22_Yn", {"Y"}, dep, line=line)

    # ══════════════════════════════════════════════════════════════════
    # Diabetes Mellitus rule:
    # If any FAMHIST has pMdiseaseCode='006' (Diabetes Mellitus),
    # then for that case's DIAGNOSTICEXAMRESULT the FBS/RBS lab
    # should be present.
    # ══════════════════════════════════════════════════════════════════
    if fh_diabetes:
        for der in root.iter("DIAGNOSTICEXAMRESULT"):
            line = getattr(der, "sourceline", None)
            case_no = _get(der, "pHciCaseNo")
            if case_no not in fh_diabetes:
                continue
            has_fbs = der.find(".//FBS") is not None
            has_rbs = der.find(".//RBS") is not None
            if not has_fbs and not has_rbs:
                result.add("WARNING", "CROSS",
                    f"<DIAGNOSTICEXAMRESULT> pHciCaseNo='{case_no}': "
                    "FBS or RBS result expected because FAMHIST has "
                    "Diabetes Mellitus (pMdiseaseCode='006')",
                    line=line)


# ─────────────────────────────────────────────
# Count verification
# ─────────────────────────────────────────────

def check_counts(root: etree._Element, result: Result):
    """Verify pEnlistTotalCnt / pProfileTotalCnt / pSoapTotalCnt on PCB root."""
    line = getattr(root, "sourceline", None)
    checks = [
        ("pEnlistTotalCnt",  "ENLISTMENT"),
        ("pProfileTotalCnt", "PROFILE"),
        ("pSoapTotalCnt",    "SOAP"),
    ]
    for attr, tag in checks:
        declared = _get(root, attr)
        if not declared:
            continue
        try:
            declared_n = int(float(declared))
        except ValueError:
            continue
        actual_n = len(root.findall(f".//{tag}"))
        if declared_n != actual_n:
            result.add("ERROR", "COUNTS",
                f"<PCB> @{attr}='{declared_n}' but document contains "
                f"{actual_n} <{tag}> element(s)",
                line=line)


# ─────────────────────────────────────────────
# Referential integrity
# ─────────────────────────────────────────────

def check_referential_integrity(root: etree._Element, result: Result):
    """Verify pHciCaseNo on SOAP/PROFILE/MEDICINE/DIAGNOSTICEXAMRESULT
    references an ENLISTMENT pHciCaseNo present in the same document."""
    enrolled = {_get(e, "pHciCaseNo")
                for e in root.iter("ENLISTMENT")
                if _get(e, "pHciCaseNo")}

    for tag in ("PROFILE", "SOAP", "MEDICINE", "DIAGNOSTICEXAMRESULT"):
        for elem in root.iter(tag):
            case_no = _get(elem, "pHciCaseNo")
            if case_no and case_no not in enrolled:
                result.add("ERROR", "REF",
                    f"<{tag}> @pHciCaseNo='{case_no}' has no matching "
                    f"<ENLISTMENT> in this document",
                    line=getattr(elem, "sourceline", None))


# ─────────────────────────────────────────────
# Primary-key uniqueness
# ─────────────────────────────────────────────

def check_unique_keys(root: etree._Element, result: Result):
    """
    pHciTransNo is documented as PK on ENLISTMENT, PROFILE, and SOAP
    (each independently -- an ENLISTMENT pHciTransNo and a PROFILE
    pHciTransNo are different keyspaces, e.g. 'E...' vs 'P...').
    A duplicate within the same element type in the same document
    would fail as a unique-constraint violation on ingest, but nothing
    upstream of this function ever compares records against each other.
    """
    for tag in ("ENLISTMENT", "PROFILE", "SOAP"):
        seen: dict[str, list] = {}
        for elem in root.iter(tag):
            key = _get(elem, "pHciTransNo")
            if key:
                seen.setdefault(key, []).append(getattr(elem, "sourceline", None))

        for key, lines in seen.items():
            if len(lines) > 1:
                result.add("ERROR", "KEYS",
                    f"<{tag}> @pHciTransNo='{key}' appears {len(lines)} times "
                    f"in this document (PK must be unique) -- lines: "
                    f"{', '.join(str(l) for l in lines if l is not None)}")


# ─────────────────────────────────────────────
# Structured-ID format checks
# ─────────────────────────────────────────────
# The data dictionary documents an exact composition for these IDs:
#   pHciTransmittalNumber = R + 9-digit accreditation no. + YYYY + MM + 5-digit series
#   ENLISTMENT.pHciTransNo = E + ... (same shape, 21 chars total)
#   PROFILE.pHciTransNo    = P + ... (21 chars total)
#   SOAP.pHciTransNo       = S + ... (21 chars total)
#   pHciCaseNo (defined on ENLISTMENT, referenced elsewhere) =
#       T + 9-digit accreditation no. + YYYY + MM + 4-digit series (20 chars total)
# Only the prefix letter and digit-count are checked here (not whether the
# embedded YYYY/MM is plausible) -- that's a more invasive check that would
# need real submission-date context to avoid false positives.

_ID_TRANSNO_RE = re.compile(r"^[A-Z]\d{20}$")   # prefix + 9+4+2+5 digits
_ID_CASENO_RE  = re.compile(r"^[A-Z]\d{19}$")   # prefix + 9+4+2+4 digits

def check_id_formats(root: etree._Element, result: Result):
    transno_rules = [
        ("PCB",         "pHciTransmittalNumber", "R"),
        ("ENLISTMENT",  "pHciTransNo",            "E"),
        ("PROFILE",     "pHciTransNo",            "P"),
        ("SOAP",        "pHciTransNo",            "S"),
    ]
    for tag, attr, prefix in transno_rules:
        for elem in root.iter(tag):
            val = _get(elem, attr)
            if not val:
                continue
            if not (val.startswith(prefix) and _ID_TRANSNO_RE.match(val)):
                result.add("WARNING", "FORMAT",
                    f"<{tag}> @{attr}='{val}' does not match the documented "
                    f"format {prefix}+9-digit accreditation no.+YYYY+MM+5-digit "
                    f"series ({prefix} followed by 20 digits)",
                    line=getattr(elem, "sourceline", None))

    for tag in ("ENLISTMENT", "PROFILE", "SOAP", "MEDICINE",
                "DIAGNOSTICEXAMRESULT", "DOCUMENT"):
        for elem in root.iter(tag):
            val = _get(elem, "pHciCaseNo")
            if not val:
                continue
            if not (val.startswith("T") and _ID_CASENO_RE.match(val)):
                result.add("WARNING", "FORMAT",
                    f"<{tag}> @pHciCaseNo='{val}' does not match the documented "
                    f"format T+9-digit accreditation no.+YYYY+MM+4-digit series "
                    f"(T followed by 19 digits)",
                    line=getattr(elem, "sourceline", None))


# ─────────────────────────────────────────────
# Demographic-conditional rules
# ─────────────────────────────────────────────

def _age_months(dob_str: str, ref_str: str):
    """Whole months between two YYYY-MM-DD dates, or None if unparsable."""
    try:
        dob = datetime.strptime(dob_str, "%Y-%m-%d")
        ref = datetime.strptime(ref_str, "%Y-%m-%d")
    except ValueError:
        return None
    months = (ref.year - dob.year) * 12 + (ref.month - dob.month)
    if ref.day < dob.day:
        months -= 1
    return months


_PEDIATRIC_PEPERT_FIELDS = ("pLength", "pHeadCirc", "pSkinfoldThickness",
                            "pWaist", "pHip", "pLimbs", "pMidUpperArmCirc")


def check_demographic_rules(root: etree._Element, result: Result):
    """
    MENSHIST / PREGHIST are documented 'For Female Patient Only'.
    Several PEPERT measurements are documented as expected only for
    patients aged 0-24 months. Neither is enforced anywhere else --
    this cross-checks them against the linked ENLISTMENT's sex/DOB.
    Both are WARNING-level: these are plausibility checks, not hard
    structural rules, and edge cases (e.g. missing/garbled DOB) should
    not fail a document outright.
    """
    enlistment_info = {}
    for e in root.iter("ENLISTMENT"):
        case_no = _get(e, "pHciCaseNo")
        if case_no:
            enlistment_info[case_no] = {
                "sex": _get(e, "pPatientSex"),
                "dob": _get(e, "pPatientDob"),
            }

    for profile in root.iter("PROFILE"):
        case_no = _get(profile, "pHciCaseNo")
        info = enlistment_info.get(case_no)
        if not info:
            continue   # already flagged by check_referential_integrity

        if info["sex"] == "M":
            for fem_tag in ("MENSHIST", "PREGHIST"):
                fem = profile.find(f".//{fem_tag}")
                if fem is not None and _get(fem, "pIsApplicable") == "Y":
                    result.add("WARNING", "DEMO",
                        f"<{fem_tag}> @pIsApplicable='Y' under PROFILE "
                        f"pHciCaseNo='{case_no}', but the linked ENLISTMENT "
                        f"@pPatientSex='M' -- {fem_tag} is documented as "
                        "female-patient-only",
                        line=getattr(fem, "sourceline", None))

        prof_date = _get(profile, "pProfDate")
        if info["dob"] and prof_date:
            age_m = _age_months(info["dob"], prof_date)
            if age_m is not None and 0 <= age_m <= 24:
                pepert = profile.find(".//PEPERT")
                if pepert is not None and not any(
                        _get(pepert, f) for f in _PEDIATRIC_PEPERT_FIELDS):
                    result.add("WARNING", "DEMO",
                        f"<PROFILE> pHciCaseNo='{case_no}': patient is "
                        f"{age_m} month(s) old at profiling -- pediatric "
                        "anthropometric fields (pLength, pHeadCirc, pWaist, "
                        "pHip, pLimbs, pSkinfoldThickness, pMidUpperArmCirc) "
                        "are documented as expected for ages 0-24 months "
                        "but are all blank",
                        line=getattr(pepert, "sourceline", None))


# ─────────────────────────────────────────────
# Cross-record identity consistency
# ─────────────────────────────────────────────

def check_identity_consistency(root: etree._Element, result: Result):
    """
    check_referential_integrity confirms a pHciCaseNo points at *some*
    ENLISTMENT. This confirms the patient identity fields on the linked
    record actually agree with that ENLISTMENT, so a SOAP/MEDICINE/
    DIAGNOSTICEXAMRESULT/PROFILE record can't reference a valid case
    number while quietly carrying a different patient's PIN/type.
    """
    enrolled = {}
    for e in root.iter("ENLISTMENT"):
        case_no = _get(e, "pHciCaseNo")
        if case_no:
            enrolled[case_no] = {
                "pMemPin":      _get(e, "pMemPin"),
                "pPatientPin":  _get(e, "pPatientPin"),
                "pPatientType": _get(e, "pPatientType"),
            }

    for tag in ("PROFILE", "SOAP", "MEDICINE", "DIAGNOSTICEXAMRESULT"):
        for elem in root.iter(tag):
            case_no = _get(elem, "pHciCaseNo")
            ref = enrolled.get(case_no)
            if not ref:
                continue   # already flagged by check_referential_integrity
            line = getattr(elem, "sourceline", None)
            for attr, expected in ref.items():
                val = _get(elem, attr)
                if val and expected and val != expected:
                    result.add("ERROR", "IDENTITY",
                        f"<{tag}> @{attr}='{val}' does not match "
                        f"<ENLISTMENT> @{attr}='{expected}' for the same "
                        f"pHciCaseNo='{case_no}'",
                        line=line)


# ─────────────────────────────────────────────
# Reporting
# ─────────────────────────────────────────────

def build_report(result: Result, strict: bool,
                 title: str = "XML CHECKER",
                 mode_label: str | None = None) -> str:
    out = StringIO()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    out.write(f"\n{'='*70}\n")
    out.write(f"  {title} — PhilHealth KonSulTa\n")
    out.write(f"  Generated : {ts}\n")
    out.write(f"  File      : {result.xml_file}\n")
    if result.dtd_file:
        out.write(f"  DTD       : {result.dtd_file}\n")
    if result.libs_dir:
        out.write(f"  Libraries : {result.libs_dir}\n")
    if mode_label is not None:
        out.write(f"  Mode      : {mode_label}\n")
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
# Shared argument parser factory
# ─────────────────────────────────────────────

def make_arg_parser(description: str) -> argparse.ArgumentParser:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_dtd  = os.path.join(script_dir, "KonsultaData_v1_14_1.dtd")
    default_libs = os.path.join(script_dir, "LIBRARIES")

    p = argparse.ArgumentParser(
        description=description,
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
    return p
