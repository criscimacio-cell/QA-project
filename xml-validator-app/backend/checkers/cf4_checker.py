"""
CF4 (EPCB) XML Checker
Fully mimics the original Oracle validation logic using:
- EPCB.dtd for structural validation (via lxml)
- lib_medicine.xlsx for drug code / medicine attribute validation
- cf4KeyDataValidator rules: byte sizes, required fields, enums, formats
"""
import os
import re
import json
import logging
import pandas as pd
import xmltodict
from lxml import etree

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REF_DIR = os.path.join(BASE_DIR, "..", "references", "cf4")
EPCB_DTD_PATH = os.path.join(REF_DIR, "EPCB.dtd")
MED_LIB_PATH = os.path.join(REF_DIR, "lib_medicine.xlsx")

_med_lib = None


def _load_med_lib():
    global _med_lib
    if _med_lib is None:
        try:
            df = pd.read_excel(MED_LIB_PATH, header=0, dtype={
                "Drug Code": str, "Drug Description": str,
                "Gen Code": str, "Salt Code": str, "Form Code": str,
                "Strength Code": str, "Unit Code": str, "Package Code": str,
            })
            _med_lib = {str(r["Drug Code"]).strip(): r for _, r in df.iterrows()}
        except Exception as e:
            logging.warning(f"Could not load medicine library: {e}")
            _med_lib = {}
    return _med_lib


# ── Rule functions (ported from rules.py) ────────────────────────────────────

def _byte_len(data):
    return len(data.encode("utf-8")) if data else 0

def _rule_byte_size(data, size):
    n = _byte_len(data)
    if n > size:
        msg = (f"Data exceeds max byte size of {size}: {n} bytes (UTF-8). Should be empty"
               if size == 0 else f"Data exceeds max byte size of {size}: {n} bytes (UTF-8)")
        return ("Data Byte Size", msg)
    return ("Data Byte Size", None)

def _rule_required(data):
    if not data:
        return ("Required", "Data is Required")
    return ("Required", None)

def _rule_format_values(data, allowed, nullable=False):
    if data not in allowed and not nullable:
        return ("Data Values Match",
                f"Data does not match required values: {sorted(allowed)}")
    return ("Data Values Match", None)

def _rule_yn(data):
    results = [_rule_byte_size(data, 1)]
    if data not in {"Y", "N"}:
        results.append(("Y,N Value", 'Data must either be "Y" or "N"'))
    else:
        results.append(("Y,N Value", None))
    return results

def _rule_integer(data):
    try:
        int(data)
        return ("Data Integer Type", None)
    except Exception:
        return ("Data Integer Type", "Data not in Integer Type")

def _rule_float(data):
    try:
        float(data)
        return ("Data Float Type", None)
    except Exception:
        return ("Data Float Type", "Data not in Float Type")

def _rule_date(data, fmt="MM-DD-YYYY"):
    results = [_rule_byte_size(data, 10)]
    if not data:
        results.append(("Data Format Match", "Data must not be empty"))
        return results
    if fmt == "MM-DD-YYYY":
        pattern = r"^\d{2}-\d{2}-\d{4}$"
    else:  # YYYY-MM-DD
        pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(pattern, data):
        results.append(("Data Format Match",
                        f"Does not match required date format: {fmt}"))
    else:
        results.append(("Data Format Match", None))
    return results

def _rule_length(data, length):
    if data and len(data) > length:
        return ("Length", f"Data exceeds max length size: {length}")
    return ("Length", None)

def _rule_required_format(data, regex):
    if not re.match(regex, data or ""):
        return ("Data Format Match", "Does not match required format")
    return ("Data Format Match", None)

def _rule_invalid_value(data, regex):
    if re.fullmatch(regex, data or "", re.IGNORECASE):
        return ("Data Invalid Value", "Invalid value found")
    return ("Data Invalid Value", None)

def _rule_required_value(data, required):
    if data != required:
        return ("Data Value Match",
                f"Data does not match required value: {required}")
    return ("Data Value Match", None)

def _rule_not_in_value(data, values):
    if data in values:
        return ("Data Value Must Not Match",
                f"Data must not be equal to: {values}")
    return ("Data Value Must Not Match", None)

def _rule_not_in_pnf(data):
    if data:
        return ("Data PNF Med", "Data does not exist in PHIC Med Library")
    return ("Data PNF Med", None)

def _rule_required_empty(data):
    if data:
        return ("Data Not Empty", "Data must be empty")
    return ("Data Not Empty", None)


# ── DD lookup sets (from cf4KeyDataValidator.py) ─────────────────────────────

DD_REQUIRED_KEYS = {
    'EPCB > @pUsername','EPCB > @pHciAccreNo','EPCB > @pCertificationId',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pEClaimId',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pHciCaseNo',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pHciTransNo',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pEffYear',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pEnlistStat',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pEnlistDate',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPackageType',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientPin',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientFname',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientLname',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientType',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientSex',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientContactno',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pPatientDob',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pCivilStatus',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pWithConsent',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pWithLoa',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pWithDisability',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pDependentType',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pTransDate',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pCreatedBy',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pReportStatus',
    'EPCB > ENLISTMENTS > ENLISTMENT > @pAvailFreeService',
    'EPCB > PROFILING > PROFILE > @pHciTransNo',
    'EPCB > PROFILING > PROFILE > @pHciCaseNo',
    'EPCB > PROFILING > PROFILE > @pPatientPin',
    'EPCB > PROFILING > PROFILE > @pProfDate',
    'EPCB > PROFILING > PROFILE > @pEffYear',
    'EPCB > PROFILING > PROFILE > @pProfileATC',
    'EPCB > PROFILING > PROFILE > @pReportStatus',
    'EPCB > PROFILING > PROFILE > OINFO > @pReportStatus',
    'EPCB > PROFILING > PROFILE > MEDHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > MHSPECIFIC > @pSpecificDesc',
    'EPCB > PROFILING > PROFILE > MHSPECIFIC > @pReportStatus',
    'EPCB > PROFILING > PROFILE > SURGHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > FAMHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > FHSPECIFIC > @pReportStatus',
    'EPCB > PROFILING > PROFILE > SOCHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > IMMUNIZATION > @pReportStatus',
    'EPCB > PROFILING > PROFILE > MENSHIST > @pIsApplicable',
    'EPCB > PROFILING > PROFILE > MENSHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > PREGHIST > @pReportStatus',
    'EPCB > PROFILING > PROFILE > BLOODTYPE > @pReportStatus',
    'EPCB > PROFILING > PROFILE > PEGENSURVEY > @pGenSurveyId',
    'EPCB > PROFILING > PROFILE > PEGENSURVEY > @pReportStatus',
    'EPCB > PROFILING > PROFILE > PEMISC > @pSkinId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pHeentId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pChestId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pHeartId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pAbdomenId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pNeuroId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pGuId',
    'EPCB > PROFILING > PROFILE > PEMISC > @pReportStatus',
    'EPCB > PROFILING > PROFILE > PESPECIFIC > @pReportStatus',
    'EPCB > PROFILING > PROFILE > DIAGNOSTIC > @pDiagnosticId',
    'EPCB > PROFILING > PROFILE > DIAGNOSTIC > @pReportStatus',
    'EPCB > PROFILING > PROFILE > ADVICE > @pRemarks',
    'EPCB > PROFILING > PROFILE > ADVICE > @pReportStatus',
    'EPCB > PROFILING > PROFILE > NCDQANS > @pReportStatus',
    'EPCB > SOAPS > SOAP > @pHciTransNo','EPCB > SOAPS > SOAP > @pHciCaseNo',
    'EPCB > SOAPS > SOAP > @pPatientPin','EPCB > SOAPS > SOAP > @pPatientType',
    'EPCB > SOAPS > SOAP > @pSoapDate','EPCB > SOAPS > SOAP > @pEffYear',
    'EPCB > SOAPS > SOAP > @pSoapATC','EPCB > SOAPS > SOAP > @pReportStatus',
    'EPCB > SOAPS > SOAP > SUBJECTIVE > @pChiefComplaint',
    'EPCB > SOAPS > SOAP > SUBJECTIVE > @pIllnessHistory',
    'EPCB > SOAPS > SOAP > SUBJECTIVE > @pSignsSymptoms',
    'EPCB > SOAPS > SOAP > SUBJECTIVE > @pReportStatus',
    'EPCB > SOAPS > SOAP > PEPERT > @pSystolic','EPCB > SOAPS > SOAP > PEPERT > @pDiastolic',
    'EPCB > SOAPS > SOAP > PEPERT > @pHr','EPCB > SOAPS > SOAP > PEPERT > @pRr',
    'EPCB > SOAPS > SOAP > PEPERT > @pTemp','EPCB > SOAPS > SOAP > PEPERT > @pHeight',
    'EPCB > SOAPS > SOAP > PEPERT > @pWeight','EPCB > SOAPS > SOAP > PEPERT > @pReportStatus',
    'EPCB > SOAPS > SOAP > ICDS > @pIcdCode','EPCB > SOAPS > SOAP > ICDS > @pReportStatus',
    'EPCB > SOAPS > SOAP > MANAGEMENT > @pManagementId',
    'EPCB > SOAPS > SOAP > MANAGEMENT > @pReportStatus',
    'EPCB > SOAPS > SOAP > ADVICE > @pReportStatus',
    'EPCB > COURSEWARDS > COURSEWARD > @pHciCaseNo',
    'EPCB > COURSEWARDS > COURSEWARD > @pHciTransNo',
    'EPCB > COURSEWARDS > COURSEWARD > @pDateAction',
    'EPCB > COURSEWARDS > COURSEWARD > @pDoctorsAction',
    'EPCB > COURSEWARDS > COURSEWARD > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > CBC > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > CBC > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > URINALYSIS > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > URINALYSIS > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > CHESTXRAY > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > CHESTXRAY > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > SPUTUM > @pDataCollection',
    'EPCB > LABRESULTS > LABRESULT > SPUTUM > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > SPUTUM > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > LIPIDPROF > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > LIPIDPROF > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > FBS > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > FBS > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > ECG > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > ECG > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > FECALYSIS > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > FECALYSIS > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > PAPSSMEAR > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > PAPSSMEAR > @pReportStatus',
    'EPCB > LABRESULTS > LABRESULT > OGTT > @pIsApplicable',
    'EPCB > LABRESULTS > LABRESULT > OGTT > @pReportStatus',
    'EPCB > MEDICINES > MEDICINE > @pHciCaseNo',
    'EPCB > MEDICINES > MEDICINE > @pHciTransNo',
    'EPCB > MEDICINES > MEDICINE > @pRoute',
    'EPCB > MEDICINES > MEDICINE > @pQuantity',
    'EPCB > MEDICINES > MEDICINE > @pTotalAmtPrice',
    'EPCB > MEDICINES > MEDICINE > @pInstructionFrequency',
    'EPCB > MEDICINES > MEDICINE > @pIsApplicable',
    'EPCB > MEDICINES > MEDICINE > @pDateAdded',
    'EPCB > MEDICINES > MEDICINE > @pModule',
    'EPCB > MEDICINES > MEDICINE > @pReportStatus',
}

DD_BYTE_SIZE_0 = {
    '@pPatientAddbrgy','@pPatientAddmun','@pPatientAddprov','@pPatientAddreg',
    '@pPatientAddzipcode','@pMemFname','@pMemMname','@pMemLname','@pMemExtname',
    '@pMemDob','@pPassword','@pEnlistTotalCnt','@pProfileTotalCnt','@pSoapTotalCnt',
    '@pEmrId','@pHciTransmittalNumber','@pMemPin','@pMemCat','@pMemNcat',
    '@pPatientPob','@pPatientAge','@pPatientOccupation','@pPatientEducation',
    '@pPatientReligion','@pPatientMotherMnln','@pPatientMotherMnmi','@pPatientMotherBday',
    '@pPatientFatherFn','@pPatientFatherExtn','@pPatientMotherFn','@pPatientFatherBday',
    '@pPatientMotherExtn','@pPatientFatherLn','@pPatientFatherMi','@pMdiseaseCode',
    '@pSurgDesc','@pSurgDate','@pIsSmoker','@pNoCigpk','@pIsAdrinker','@pNoBottles',
    '@pIllDrugUser','@pChildImmcode','@pYoungwImmcode','@pPregwImmcode',
    '@pElderlyImmcode','@pOtherImm','@pMenarchePeriod','@pPeriodDuration',
    '@pMensInterval','@pPadsPerDay','@pOnsetSexIc','@pBirthCtrlMethod',
    '@pIsMenopause','@pMenopauseAge','@pDeliveryTyp','@pWPregIndhyp','@pWFamPlan',
    '@pBloodType','@pBloodRh','@pRectalId','@pActualUnitPrice','@pInstructionQuantity',
    '@pInstructionStrength','@pPrescPhysician','@pReferralFacility',
}
DD_BYTE_SIZE_0_SPECIFICS = {
    'EPCB > LABRESULTS > LABRESULT > @pHciCaseNo',
    'EPCB > LABRESULTS > LABRESULT > CBC > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > URINALYSIS > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > CHESTXRAY > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > SPUTUM > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > LIPIDPROF > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > FBS > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > ECG > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > FECALYSIS > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > PAPSSMEAR > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > OGTT > @pHciTransNo',
    'EPCB > LABRESULTS > LABRESULT > @pPatientType',
    'EPCB > LABRESULTS > LABRESULT > @pEffYear',
    'EPCB > LABRESULTS > LABRESULT > SPUTUM > @pRemarks',
    'EPCB > LABRESULTS > LABRESULT > ECG > @pRemarks',
    'EPCB > PROFILING > PROFILE > @pPatientType',
    'EPCB > PROFILING > PROFILE > FHSPECIFIC > @pSpecificDesc',
    'EPCB > PROFILING > PROFILE > @pEffYear',
}
DD_BYTE_SIZE_1  = {'@pEnlistStat','@pPackageType','@pPatientSex','@pCivilStatus','@pWithConsent','@pWithLoa','@pWithDisability','@pDependentType','@pReportStatus','@pDataCollection'}
DD_BYTE_SIZE_2  = {'@pPatientType'}
DD_BYTE_SIZE_3  = {'@pSkinId','@pHeentId','@pChestId','@pHeartId','@pAbdomenId','@pNeuroId','@pGuId'}
DD_BYTE_SIZE_4  = {'@pEffYear','@pModule'}
DD_BYTE_SIZE_5  = {'@pGenericCode','@pSaltCode','@pStrengthCode','@pFormCode','@pUnitCode','@pPackageCode'}
DD_BYTE_SIZE_9  = {'@pHciAccreNo'}
DD_BYTE_SIZE_10 = {'@pProfileATC','@pSoapATC','@pIcdCode'}
DD_BYTE_SIZE_12 = {'@pPatientPin'}
DD_BYTE_SIZE_15 = {'@pPatientContactno'}
DD_BYTE_SIZE_21 = {'@pCertificationId','@pEClaimID','@pHciCaseNo','@pHciTransNo','@pClaimID','@pClaimsTransmittalID'}
DD_BYTE_SIZE_30 = {'@pUsername','@pPatientMname','@pPatientLname','@pPatientExtname','@pCreatedBy','@pDrugCode','@pPatientFname'}
DD_BYTE_SIZE_50 = {'@pInstructionFrequency'}
DD_BYTE_SIZE_500  = {'@pPainSite','@pGenericName','@pRoute'}
DD_BYTE_SIZE_2000 = {'@pSpecificDesc','@pDeficiencyRemarks','@pGenSurveyRem','@pRemarks','@pSkinRem','@pHeentRem','@pChestRem','@pHeartRem','@pAbdomenRem','@pNeuroRem','@pGuRem','@pChiefComplaint','@pIllnessHistory','@pOtherComplaint','@pSignsSymptoms','@pDoctorsAction'}
DD_YES_NO_NA_KEYS = {'@pWithConsent','@pWithLoa','@pWithDisability','@pAvailFreeService'}
DD_YES_NO_KEYS  = {'@pIsApplicable'}
DD_DATE_FORMAT  = {'@pTransDate','@pPatientDob','@pProfDate','@pLastMensPeriod','@pSoapDate','@pDateAdded','@pDateAction'}
DD_INTEGER_FORMAT = {'@pPregCnt','@pDeliveryCnt','@pFullTermCnt','@pPrematureCnt','@pAbortionCnt','@pLivChildrenCnt','@pHr','@pRr'}
DD_FLOAT_FORMAT = {'@pSystolic','@pDiastolic','@pTemp','@pHeight','@pWeight','@pActualUnitPrice'}


def _validate_field(key, data, xml_tree, cf4, list_index=None, med_lib_data=None):
    """Apply all CF4 validation rules to a single field. Returns list of violation strings."""
    violations = []

    def add(rule_result):
        if isinstance(rule_result, list):
            for r in rule_result:
                _add_single(r)
        else:
            _add_single(rule_result)

    def _add_single(r):
        rule_name, msg = r
        if msg:
            violations.append(f"[{rule_name}] {msg}")

    if xml_tree in DD_REQUIRED_KEYS:
        add(_rule_required(data))
    if key in DD_BYTE_SIZE_0:
        add(_rule_byte_size(data, 0))
    if xml_tree in DD_BYTE_SIZE_0_SPECIFICS:
        add(_rule_byte_size(data, 0))
    if key in DD_BYTE_SIZE_1:  add(_rule_byte_size(data, 1))
    if key in DD_BYTE_SIZE_2:  add(_rule_byte_size(data, 2))
    if key in DD_BYTE_SIZE_3:
        add(_rule_byte_size(data, 3))
        if data: add(_rule_integer(data))
    if key in DD_BYTE_SIZE_4:  add(_rule_byte_size(data, 4))
    if key in DD_BYTE_SIZE_5:  add(_rule_byte_size(data, 5))
    if key in DD_BYTE_SIZE_9:  add(_rule_byte_size(data, 9))
    if key in DD_BYTE_SIZE_10: add(_rule_byte_size(data, 10))
    if key in DD_BYTE_SIZE_12: add(_rule_byte_size(data, 12))
    if key in DD_BYTE_SIZE_15: add(_rule_byte_size(data, 15))
    if key in DD_BYTE_SIZE_21: add(_rule_byte_size(data, 21))
    if key in DD_BYTE_SIZE_30: add(_rule_byte_size(data, 30))
    if key in DD_BYTE_SIZE_50: add(_rule_byte_size(data, 50))
    if key in DD_BYTE_SIZE_500:  add(_rule_byte_size(data, 500))
    if key in DD_BYTE_SIZE_2000: add(_rule_byte_size(data, 2000))
    if key in DD_YES_NO_KEYS:    add(_rule_yn(data))
    if key in DD_YES_NO_NA_KEYS: add(_rule_format_values(data, {'Y','N','X'}))
    if key in DD_DATE_FORMAT and data: add(_rule_date(data, fmt="YYYY-MM-DD"))
    if key in DD_INTEGER_FORMAT and data: add(_rule_integer(data))
    if key in DD_FLOAT_FORMAT and data:   add(_rule_float(data))

    # ── Specific field rules ──────────────────────────────────────────────────

    if key == '@pPatientType':
        add(_rule_format_values(data, {'MM','DD','NM',''}))
    if key == '@pProfileATC' and not data:
        add(_rule_format_values(data, {'CF4'}))
    if key in {'@pHr','@pRr'}:
        add(_rule_length(data, 3))
        if data: add(_rule_integer(data))
    if key == '@pTemp':
        add(_rule_length(data, 4))
        if data: add(_rule_float(data))
    if key in {'@pHeight','@pWeight'}:
        add(_rule_length(data, 6))
        if data: add(_rule_float(data))
    if key == '@pReportStatus':
        add(_rule_format_values(data, {'V','U','F'}))
    if key == '@pPatientSex':
        add(_rule_format_values(data, {'M','F'}))
    if key == '@pPatientContactno':
        add(_rule_format_values(data, {'NA'}))
    if key == '@pCivilStatus' and not data:
        add(_rule_format_values(data, {'U'}))
    if key == '@pModule':
        add(_rule_format_values(data, {'CF4','HAS','SOAP'}))
    if key == '@pDataCollection':
        add(_rule_format_values(data, {'X','1','2','3','4'}))
    if key in {'@pChiefComplaint','@pIllnessHistory'}:
        add(_rule_invalid_value(data, r'none|NA|not applicable|N/A'))

    # Remarks conditional on "Others" selection
    remark_map = {
        '@pSkinRem':'@pSkinId','@pHeentRem':'@pHeentId','@pChestRem':'@pChestId',
        '@pHeartRem':'@pHeartId','@pAbdomenRem':'@pAbdomenId','@pNeuroRem':'@pNeuroId',
        '@pGuRem':'@pGuId',
    }
    if key in remark_map:
        try:
            pemisc_list = cf4['EPCB']['PROFILING']['PROFILE']['PEMISC']
            if not isinstance(pemisc_list, list):
                pemisc_list = [pemisc_list]
            id_key = remark_map[key]
            id_val = pemisc_list[list_index or 0].get(id_key, '') if list_index is not None else pemisc_list[0].get(id_key, '')
            if id_val == 'Others':
                add(_rule_invalid_value(data, r'none|NA|not applicable|N/A'))
        except Exception:
            pass

    # Menstrual history conditional
    if key in {'@pPregCnt','@pDeliveryCnt','@pFullTermCnt','@pPrematureCnt','@pAbortionCnt','@pLivChildrenCnt','@pLastMensPeriod'}:
        try:
            is_applicable = cf4['EPCB']['PROFILING']['PROFILE']['MENSHIST'].get('@pIsApplicable','')
            if is_applicable != 'Y':
                add(_rule_byte_size(data, 0))
        except Exception:
            pass

    # GenSurveyRem conditional
    if key == '@pGenSurveyRem':
        try:
            survey_id = cf4['EPCB']['PROFILING']['PROFILE']['PEGENSURVEY'].get('@pGenSurveyId','')
            if survey_id != '2' and data:
                add(("Required If @pGenSurveyId=2", "Only required when GenSurveyId is 2"))
        except Exception:
            pass

    # Medicine section rules
    if str(xml_tree).startswith('EPCB > MEDICINES > MEDICINE'):
        try:
            med_list = cf4['EPCB']['MEDICINES']['MEDICINE']
            if not isinstance(med_list, list):
                med_list = [med_list]
            med_item = med_list[list_index] if list_index is not None else med_list[0]
            is_applicable = med_item.get('@pIsApplicable','')
        except Exception:
            is_applicable = ''

        if is_applicable == 'Y':
            if key == '@pRoute':
                add(_rule_required(data))
                add(_rule_not_in_value(data, {'na','NA','n/a','N/A'}))
                add(_rule_byte_size(data, 500))
            if key == '@pInstructionFrequency':
                add(_rule_length(data, 50))
                add(_rule_not_in_value(data, {'na','NA','n/a','N/A'}))
            if key == '@pTotalAmtPrice':
                add(_rule_required_format(data, r'^\d+(\.\d{1,2})?$'))

            if med_lib_data:
                code_checks = {
                    '@pGenericCode': 'Gen Code', '@pSaltCode': 'Salt Code',
                    '@pFormCode': 'Form Code', '@pStrengthCode': 'Strength Code',
                    '@pUnitCode': 'Unit Code', '@pPackageCode': 'Package Code',
                }
                if key in code_checks:
                    add(_rule_required_value(data, str(med_lib_data[code_checks[key]])))
            else:
                if key == '@pDrugCode': add(_rule_not_in_pnf(data))
                if key == '@pGenericName': add(_rule_required(data))
                for empty_key in ('@pGenericCode','@pSaltCode','@pFormCode','@pStrengthCode','@pUnitCode','@pPackageCode'):
                    if key == empty_key: add(_rule_required_empty(data))
        else:
            fixed = {
                '@pRoute':'-','@pQuantity':'0','@pTotalAmtPrice':'0','@pInstructionFrequency':'-',
            }
            if key in fixed:
                add(_rule_required_value(data, fixed[key]))

    return violations


# ── Recursive XML traversal (mirrors xml-checker.py logic) ───────────────────

def _traverse(key, dict_data, cf4, results, parent_key="", list_index=None, med_lib=None, med_lib_data=None):
    if parent_key:
        xml_tree = parent_key + (f"[{list_index}]" if list_index is not None else "") + f" > {key}"
    else:
        xml_tree = key

    is_medicines = xml_tree.rstrip(f"[{list_index}]" if list_index is not None else "") == 'EPCB > MEDICINES > MEDICINE'

    val = dict_data.get(key)

    if isinstance(val, dict):
        if is_medicines and med_lib:
            drug_code = val.get('@pDrugCode','').strip()
            med_lib_data = med_lib.get(drug_code)
        for sub_key in val:
            _traverse(sub_key, val, cf4, results, xml_tree, med_lib=med_lib, med_lib_data=med_lib_data)

    elif isinstance(val, list):
        for idx, item in enumerate(val):
            if isinstance(item, dict):
                if is_medicines and med_lib:
                    drug_code = item.get('@pDrugCode','').strip()
                    med_lib_data = med_lib.get(drug_code)
                for sub_key in item:
                    _traverse(sub_key, item, cf4, results, xml_tree, list_index=idx, med_lib=med_lib, med_lib_data=med_lib_data)
    else:
        # Leaf value — run validation
        attr_key = f"@{key}" if not key.startswith('@') else key
        violations = _validate_field(attr_key, val, xml_tree, cf4, list_index=list_index, med_lib_data=med_lib_data)
        for v in violations:
            results.append({
                "field": xml_tree,
                "rule": attr_key,
                "message": v,
                "line": None,
                "severity": "error",
            })


# ── Main entry point ──────────────────────────────────────────────────────────

def check_cf4(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. DTD structural validation
    if os.path.exists(EPCB_DTD_PATH):
        try:
            dtd = etree.DTD(file=EPCB_DTD_PATH)
            tree = etree.fromstring(xml_bytes)
            if not dtd.validate(tree):
                for e in dtd.error_log:
                    errors.append({
                        "field": "DTD",
                        "rule": "dtd_structure",
                        "message": e.message,
                        "line": e.line,
                        "severity": "error",
                    })
        except etree.XMLSyntaxError as e:
            return {"filename": filename, "status": "fail", "errors": [{
                "field": "XML", "rule": "well_formed",
                "message": f"XML syntax error: {e}", "line": None, "severity": "error",
            }]}
    else:
        errors.append({"field": "DTD", "rule": "dtd_missing",
                       "message": "EPCB.dtd not found — structural validation skipped",
                       "line": None, "severity": "warning"})

    # 2. Parse with xmltodict (same as original script)
    try:
        cf4 = xmltodict.parse(content)
    except Exception as e:
        return {"filename": filename, "status": "fail", "errors": [{
            "field": "XML", "rule": "well_formed",
            "message": f"XML parse error: {e}", "line": None, "severity": "error",
        }]}

    # Must be an EPCB document
    if 'EPCB' not in cf4:
        errors.append({"field": "root", "rule": "valid_root",
                       "message": f"Root element must be <EPCB>",
                       "line": 1, "severity": "error"})
        return {"filename": filename, "status": "fail", "errors": errors}

    # 3. Load medicine library
    med_lib = _load_med_lib()

    # 4. Traverse all fields and apply rules
    field_errors = []
    _traverse('EPCB', cf4, cf4, field_errors, med_lib=med_lib)
    errors.extend(field_errors)

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
