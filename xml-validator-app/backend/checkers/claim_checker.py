"""
eClaims XML Checker
Ports eClaimKeyDataValidator.py rules exactly, matching the original script behaviour.
"""
import os
import re
import logging
import xmltodict
from lxml import etree

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REF_DIR  = os.path.join(BASE_DIR, "..", "references", "claim")
DTD_PATH = os.path.join(REF_DIR, "eClaimsDef (2).dtd")


# ── Rule helpers (ported from rules.py) ──────────────────────────────────────

def _rule_required(data):
    if not data:
        return ("Required", "Data is Required")
    return ("Required", None)

def _rule_length(data, length):
    val = str(data) if data is not None else ""
    if len(val) > length:
        return ("Length", f"Data exceeds PHIC max length size: {length}")
    return ("Length", None)

def _rule_yn(data):
    results = [_rule_length(data, 1)]
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
    results = [_rule_length(data, 10)]
    if not data:
        results.append(("Data Format Match", "Data must not be empty"))
        return results
    if fmt == "MM-DD-YYYY":
        pattern = r"^\d{2}-\d{2}-\d{4}$"
    else:
        pattern = r"^\d{4}-\d{2}-\d{2}$"
    if not re.match(pattern, data):
        results.append(("Data Format Match", f"Does not match required date format: {fmt}"))
    else:
        results.append(("Data Format Match", None))
    return results

def _rule_time(data):
    results = [_rule_length(data, 11)]
    if not data:
        results.append(("Data Format Match", "Data must not be empty"))
        return results
    try:
        parts = data.split(":")
        hour = int(parts[0])
        minute = int(parts[1])
        sec_mer = parts[2]
        int(sec_mer[:2])
        if sec_mer[2:] not in ("AM", "PM"):
            raise ValueError
        results.append(("Data Format Match", None))
    except Exception:
        results.append(("Data Format Match", "Does not match PHIC required time format: HH:MM:SSAM/PM"))
    return results

def _rule_format_values(data, allowed):
    if data not in allowed:
        return ("Data Values Match", f"Data does not match required values: {sorted(allowed)}")
    return ("Data Values Match", None)

def _rule_required_format(data, regex):
    if not re.match(regex, data or ""):
        return ("Data Format Match", "Does not match required format")
    return ("Data Format Match", None)

def _rule_alpha_only(data):
    invalid = re.findall(r"[^A-Za-zñÑ/()/,/./\-]", (data or "").replace(" ", ""))
    if invalid:
        return ("Alpha Characters Only", f"Invalid Characters: {invalid}")
    return ("Alpha Characters Only", None)

def _rule_not_in_xml():
    return ("Key Not In XML", "Key not in XML")


# ── Lookup sets (from eClaimKeyDataValidator.py) ──────────────────────────────

DD_REQUIRED_KEYS = {
    '@pUserName','@pUserPassword','@pHospitalCode','@pHospitalEmail',
    '@pHospitalTransmittalNo','@pTotalClaims',
    '@pClaimNumber','@pTrackingNumber','@pPatientType','@pIsEmergency',
    '@pClaimSeriesLhio',
    '@pMemberPIN','@pMemberLastName','@pMemberFirstName','@pMemberSuffix',
    '@pMemberMiddleName','@pMemberBirthDate','@pMemberShipType','@pMailingAddress',
    '@pZipCode','@pMemberSex','@pLandlineNo','@pMobileNo','@pEmailAddress',
    '@pPatientIs','@pPatientPIN','@pPatientLastName','@pPatientFirstName',
    '@pPatientMiddleName','@pPatientSuffix','@pPatientBirthDate','@pPatientSex',
    '@pPEN','@pEmployerName',
    '@pPatientReferred','@pReferredIHCPAccreCode',
    '@pAdmissionDate','@pAdmissionTime','@pDischargeDate','@pDischargeTime',
    '@pDisposition','@pExpiredDate','@pExpiredTime','@pReferralIHCPAccreCode',
    '@pReferralReasons','@pAccommodationType',
    '@pAdmissionDiagnosis','@pDischargeDiagnosis',
    '@pICDCode','@pRelatedProcedure','@pProcedureDate','@pLaterality',
    '@pSessionDate',
    '@pCheckUpDate1','@pCheckUpDate2','@pCheckUpDate3','@pCheckUpDate4',
    '@pTBType','@pNTPCardNo',
    '@pDay0ARV','@pDay3ARV','@pDay7ARV','@pRIG','@pABPOthers','@pABPSpecify',
    '@pEssentialNewbornCare','@pNewbornHearingScreeningTest','@pNewbornScreeningTest','@pFilterCardNo',
    '@pLaboratoryNumber',
    '@pCataractPreAuth','@pLeftEyeIOLStickerNumber','@pLeftEyeIOLExpiryDate',
    '@pRightEyeIOLStickerNumber','@pRightEyeIOLExpiryDate',
    '@pDoctorAccreCode','@pDoctorLastName','@pDoctorFirstName','@pDoctorMiddleName',
    '@pDoctorSuffix','@pWithCoPay','@pDoctorSignDate',
    '@pEnoughBenefits',
    '@pDateSigned',
    '@pMemberPatient','@pHMO','@pOthers',
    '@pDrugsMedicinesSupplies','@pExaminations',
    '@pCaseRateCode','@pCaseRateAmount',
    '@pZBenefitCode','@pPreAuthDate',
    '@pChiefComplaint','@pBriefHistory','@pCourseWard','@pPertinentFindings',
    '@pMCPOrientation','@pPrenatalConsultation','@pExpectedDeliveryDate',
    '@pVitalSigns','@pPregnancyLowRisk','@pLMP','@pMenarcheAge',
    '@pObstetricG','@pObstetricP','@pObstetric_T','@pObstetric_P','@pObstetric_A','@pObstetric_L',
    '@pMultiplePregnancy','@pOvarianCyst','@pMyomaUteri','@pPlacentaPrevia',
    '@pMiscarriages','@pStillBirth','@pPreEclampsia','@pEclampsia','@pPrematureContraction',
    '@pHypertension','@pHeartDisease','@pDiabetes','@pThyroidDisaster','@pObesity',
    '@pAsthma','@pEpilepsy','@pRenalDisease','@pBleedingDisorders','@pPreviousCS',
    '@pUterineMyomectomy',
    '@pVisitDate','@pAOGWeeks','@pWeight','@pCardiacRate','@pRespiratoryRate',
    '@pBloodPressure','@pTemperature',
    '@pDeliveryDate','@pDeliveryTime','@pObstetricIndex','@pAOGLMP',
    '@pDeliveryManner','@pPresentation','@pFetalOutcome','@pSex','@pBirthWeight',
    '@pAPGARScore','@pPostpartum',
    '@pPerinealWoundCare','@pMaternalComplications','@pBreastFeeding',
    '@pFamilyPlanning','@pPlanningService','@pSurgicalSterilization','@pFollowupSchedule',
    '@pPerinealRemarks','@pMaternalRemarks','@pBreastFeedingRemarks',
    '@pFamilyPlanningRemarks','@pPlanningServiceRemarks','@pSterilizationRemarks','@pFollowupScheduleRemarks',
    '@pIntensive','@pMaintenance','@pReferredReason',
    '@pBP','@pCR','@pRR','@pTemp','@pHEENT','@pChestLungs','@pCVS',
    '@pAbdomen','@pGUIE','@pSkinExtremities','@pNeuroExam',
    '@pCourseDate','@pFindings','@pAction',
    '@pGenericName','@pBrandName','@pPreparation','@pDrugCode','@pPNDFCode',
    '@pDiagnosticName',
    '@pCompanyName','@pBIRPermitNumber','@pReceiptNumber','@pReceiptDate',
    '@pDescription','@pDocumentType','@pDocumentURL',
}

DTD_YES_NO_KEYS = {
    '@pIsEmergency','@pPatientReferred','@pHasAttachedSOA','@pEssentialNewbornCare',
    '@pNewbornHearingScreeningTest','@pWithCoPay','@pEnoughBenefits','@pMemberPatient',
    '@pHMO','@pOthers','@pDrugsMedicinesSupplies','@pExaminations','@pMCPOrientation',
    '@pVitalSigns','@pPregnancyLowRisk','@pMultiplePregnancy','@pOvarianCyst',
    '@pMyomaUteri','@pPlacentaPrevia','@pMiscarriages','@pStillBirth','@pPreEclampsia',
    '@pEclampsia','@pPrematureContraction','@pHypertension','@pHeartDisease','@pDiabetes',
    '@pThyroidDisaster','@pObesity','@pAsthma','@pEpilepsy','@pRenalDisease',
    '@pBleedingDisorders','@pPreviousCS','@pUterineMyomectomy','@pPerinealWoundCare',
    '@pMaternalComplications','@pFamilyPlanning','@pBreastFeeding','@pPlanningService',
    '@pSurgicalSterilization','@pFollowupSchedule','@pIntensive','@pMaintenance','@pHasAttachedSOA',
}

GUIDELINE_LENGTH_1   = {'@pPatientType','@pReasonCode','@pMemberSex','@pPatientSex','@pSex','@pPatientIs','@pDisposition','@pAccommodationType','@pLaterality','@pTBType','@pNewbornHearingScreeningTestResult','@pNewbornScreeningTest','@pRelCode','@pThumbmarkedBy','@pDrying','@pSkinToSkin','@pCordClamping','@pProphylaxis','@pWeighing','@pVitaminK','@pBCG','@pNonSeparation','@pHepatitisB'}
GUIDELINE_LENGTH_2   = {'@pMemberShipType','@pMenarcheAge'}
GUIDELINE_LENGTH_3   = {'@pTotalClaims','@pAOGWeeks','@pDocumentType','@pErrCode'}
GUIDELINE_LENGTH_4   = {'@pZipCode'}
GUIDELINE_LENGTH_5   = {'@pMemberSuffix','@pPatientSuffix','@pDoctorSuffix'}
GUIDELINE_LENGTH_6   = {'@pCaseRateCode','@pRVSCode'}
GUIDELINE_LENGTH_7   = {'@pZBenefitCode'}
GUIDELINE_LENGTH_10  = {'@pObstetricG','@pObstetricP','@pObstetric_T','@pObstetric_P','@pObstetric_A','@pObstetric_L','@pWeight','@pCardiacRate','@pRespiratoryRate','@pBloodPressure','@pTemperature','@pAPGARScore','@pNTPCardNo','@pRIG','@pABPOthers','@pBirthWeight','@pQuantity','@pVATExemptSale','@pVAT','@pTotal','@pUnitPrice','@pAmount'}
GUIDELINE_LENGTH_12  = {'@pHospitalCode','@pPIN','@pClaimNumber','@pDoctorAccreCode','@pDoctorCoPay','@pMemberPIN','@pPatientPIN','@pPEN','@pReferredIHCPAccreCode','@pReferralIHCPAccreCode','@pTotalHCIFees','@pTotalProfFees','@pGrandTotal','@pTotalActualCharges','@pDiscount','@pPhilhealthBenefit','@pTotalAmount','@pDMSTotalAmount','@pExamTotalAmount','@pCaseRateAmount'}
GUIDELINE_LENGTH_15  = {'@pClaimSeriesLhio','@pICDCode','@pCompanyTIN'}
GUIDELINE_LENGTH_18  = {'@pTransmissionControlNumber','@pReceiptTicketNumber'}
GUIDELINE_LENGTH_20  = {'@pUserName','@pUserPassword','@pCataractPreAuth','@pTrackingNumber','@pLandlineNo','@pMobileNo','@pNewbornHearingRegistryNo','@pLaboratoryNumber','@pBP','@pCR','@pRR','@pTemp','@pHEENT','@pChestLungs','@pCVS','@pAbdomen','@pGUIE','@pSkinExtremities','@pNeuroExam','@pDrugCode','@pPNDFCode','@pBIRPermitNumber','@pReceiptNumber','@pHospitalTransmittalNo','@pPhilhealthClaimType','@pFilterCardNo','@pDiagnosticType'}
GUIDELINE_LENGTH_30  = {'@pPreparation'}
GUIDELINE_LENGTH_50  = {'@pABPSpecify','@pObstetricIndex','@pAOGLMP','@pDeliveryManner','@pPresentation','@pFetalOutcome','@pServiceProvider','@pCertificateId','@pGenericName','@pBrandName','@pDiagnosticName','@pRelDesc','@pReasonDesc'}
GUIDELINE_LENGTH_60  = {'@pMemberLastName','@pMemberFirstName','@pMemberMiddleName','@pPatientLastName','@pPatientFirstName','@pPatientMiddleName','@pDoctorLastName','@pDoctorFirstName','@pDoctorMiddleName'}
GUIDELINE_LENGTH_100 = {'@pEmployerName','@pPerinealRemarks','@pMaternalRemarks','@pBreastFeedingRemarks','@pFamilyPlanningRemarks','@pPlanningServiceRemarks','@pSterilizationRemarks','@pFollowupScheduleRemarks','@pCompanyName','@pDescription','@pErrDescription'}
GUIDELINE_LENGTH_150 = {'@pHospitalEmail','@pMailingAddress','@pEmailAddress','@pRelatedProcedure','@pReferralReasons'}
GUIDELINE_LENGTH_200 = {'@pChiefComplaint','@pCriteria','@pFindings','@pAction'}
GUIDELINE_LENGTH_250 = {'@pDocumentURL'}
GUIDELINE_LENGTH_500 = {'@pAdmissionDiagnosis','@pDischargeDiagnosis','@pCourseWard','@pPertinentFindings','@pReferredReason'}
GUIDELINE_LENGTH_2500= {'@pBriefHistory'}

GUIDELINE_INTEGER_FORMAT = {'@pTotalClaims','@pClaimSeriesLhio','@pMemberPIN','@pPatientPIN','@pZipCode','@pMenarcheAge','@pBirthWeight','@pQuantity'}
GUIDELINE_FLOAT_FORMAT   = {'@pVATExemptSale','@pVAT','@pTotal','@pUnitPrice','@pAmount','@pDoctorCoPay','@pTotalHCIFees','@pTotalProfFees','@pGrandTotal','@pTotalActualCharges','@pDiscount','@pPhilhealthBenefit','@pTotalAmount','@pDMSTotalAmount','@pExamTotalAmount','@pCaseRateAmount'}
GUIDELINE_DATE_FORMAT    = {'@pMemberBirthDate','@pPatientBirthDate','@pAdmissionDate','@pDischargeDate','@pProcedureDate','@pSessionDate','@pCheckUpDate1','@pCheckUpDate2','@pCheckUpDate3','@pCheckUpDate4','@pDay0ARV','@pDay3ARV','@pDay7ARV','@pDoctorSignDate','@pPrenatalConsultation','@pExpectedDeliveryDate','@pPregnancyLowRisk','@pLMP','@pVisitDate','@pDeliveryDate','@pPostpartum','@pCourseDate','@pPurchaseDate','@pDiagnosticDate','@pReceiptDate','@pTransmissionDate','@pReceivedDate','@pDateSigned','@pPreAuthDate','@pExpiredDate'}
GUIDELINE_TIME_FORMAT    = {'@pAdmissionTime','@pDischargeTime','@pDeliveryTime','@pTransmissionTime','@pExpiredTime'}

REPETITIVE_PROCEDURES = {'HEMODIALYSIS','PERITONEAL','LINAC','COBALT','TRANSFUSION','BRACHYTHERAPHY','CHEMOTHERAPY','DEBRIDEMENT','IMRT'}

LENGTH_SETS = [
    (1, GUIDELINE_LENGTH_1), (2, GUIDELINE_LENGTH_2), (3, GUIDELINE_LENGTH_3),
    (4, GUIDELINE_LENGTH_4), (5, GUIDELINE_LENGTH_5), (6, GUIDELINE_LENGTH_6),
    (7, GUIDELINE_LENGTH_7), (10, GUIDELINE_LENGTH_10), (12, GUIDELINE_LENGTH_12),
    (15, GUIDELINE_LENGTH_15), (18, GUIDELINE_LENGTH_18), (20, GUIDELINE_LENGTH_20),
    (30, GUIDELINE_LENGTH_30), (50, GUIDELINE_LENGTH_50), (60, GUIDELINE_LENGTH_60),
    (100, GUIDELINE_LENGTH_100), (150, GUIDELINE_LENGTH_150), (200, GUIDELINE_LENGTH_200),
    (250, GUIDELINE_LENGTH_250), (500, GUIDELINE_LENGTH_500), (2500, GUIDELINE_LENGTH_2500),
]


# ── Field validator ───────────────────────────────────────────────────────────

def _validate_field(key, data, xml_tree, claim, list_index=None):
    violations = []

    def add(rule_result):
        if isinstance(rule_result, list):
            for r in rule_result: _add_one(r)
        else:
            _add_one(rule_result)

    def _add_one(r):
        rule_name, msg = r
        if msg:
            violations.append(f"[{rule_name}] {msg}")

    def remove_required():
        violations[:] = [v for v in violations if not v.startswith("[Required]")]

    if key in DD_REQUIRED_KEYS:
        add(_rule_required(data))

    if key in DTD_YES_NO_KEYS:
        add(_rule_yn(data))

    for max_len, keys_set in LENGTH_SETS:
        if key in keys_set:
            if key == '@pClaimNumber':
                add(_rule_length(str(data or "").replace("stash-", ""), max_len))
            else:
                add(_rule_length(data, max_len))

    if key in GUIDELINE_INTEGER_FORMAT:
        add(_rule_integer(data))
    if key in GUIDELINE_FLOAT_FORMAT:
        add(_rule_float(data))
    if key in GUIDELINE_DATE_FORMAT:
        add(_rule_date(data, fmt="MM-DD-YYYY"))
    if key in GUIDELINE_TIME_FORMAT:
        add(_rule_time(data))

    # ── Specific rules ────────────────────────────────────────────────────────

    if key == '@pClaimSeriesLhio' and not data:
        add(_rule_not_in_xml())

    if key == '@pPhilhealthClaimType':
        add(_rule_format_values(data, {'ALL-CASE-RATE', 'Z-BENEFIT'}))
    if key == '@pPatientType':
        add(_rule_format_values(data, {'I', 'O'}))
    if key in {'@pMemberSex', '@pPatientSex', '@pSex'}:
        add(_rule_format_values(data, {'M', 'F'}))
    if key == '@pPatientIs':
        add(_rule_format_values(data, {'M', 'S', 'C', 'P'}))
    if key == '@pMemberShipType':
        add(_rule_format_values(data, {'S', 'G', 'I', 'NS', 'NO', 'PS', 'PG', 'P'}))
    if key == '@pDisposition':
        add(_rule_format_values(data, {'I', 'R', 'H', 'A', 'E', 'T'}))
    if key == '@pAccommodationType':
        add(_rule_format_values(data, {'P', 'N'}))
    if key == '@pLaterality':
        add(_rule_format_values(data, {'L', 'R', 'B', 'N'}))
    if key == '@pTBType':
        add(_rule_format_values(data, {'I', 'M'}))
    if key == '@pNewbornHearingScreeningTestResult':
        add(_rule_format_values(data, {'P', 'R', 'X'}))
    if key == '@pDiagnosticType':
        add(_rule_format_values(data, {'IMAGING', 'LABORATORY', 'SUPPLIES', 'OTHERS'}))
    if key == '@pThumbmarkedBy':
        add(_rule_format_values(data, {'P', 'R'}))

    if key == '@pRelCode' and data:
        if 'OTHERPATREPREL' in str(xml_tree):
            add(_rule_format_values(data, {'O'}))
        else:
            add(_rule_format_values(data, {'S', 'C', 'P', 'I', 'O'}))

    if key == '@pReasonCode' and data:
        if 'DEFINEDREASONFORSIGNING' in str(xml_tree):
            add(_rule_format_values(data, {'I'}))
        elif 'OTHERREASONFORSIGNING' in str(xml_tree):
            add(_rule_format_values(data, {'O'}))

    if key == '@pZBenefitCode':
        add(_rule_format_values(data, {
            'Z0011','Z0012','Z0013','Z0021','Z0022','Z003',
            'Z0041','Z0042','Z0051','Z0052','Z0061','Z0062',
            'Z0071','Z0072','Z0081','Z0082','Z0091','Z0092',
        }))

    if key == '@pICDCode' and data:
        add(_rule_required_format(data, r'^[A-Z]\d{2}\.?\d{0,2}$'))

    if key == '@pCompanyTIN':
        add(_rule_required_format(data, r'^\d{3}-\d{3}-\d{3}-\d{3}$'))

    if key == '@pDoctorAccreCode':
        add(_rule_required_format(data, r'^\d{12}$'))

    if key == '@pRelatedProcedure':
        add(_rule_alpha_only(data))

    if key == '@pExpiredDate':
        try:
            if claim.get('CF2', {}).get('@pDisposition') == 'E':
                add(_rule_date(data, fmt="MM-DD-YYYY"))
        except Exception:
            pass

    # Conditional: remove required when not applicable
    if key in {'@pPatientLastName', '@pPatientFirstName', '@pPatientMiddleName'}:
        try:
            if claim['CF1']['@pPatientIs'] == 'M':
                remove_required()
        except Exception:
            pass

    if key in {'@pPEN', '@pEmployerName'}:
        try:
            if claim['CF1']['@pMemberShipType'] not in {'S', 'G'}:
                remove_required()
        except Exception:
            pass

    if key == '@pReferredIHCPAccreCode':
        try:
            if claim['CF2']['@pPatientReferred'] != 'Y':
                remove_required()
        except Exception:
            pass

    if key in {'@pReferralIHCPAccreCode', '@pReferralReasons'}:
        try:
            if claim['CF2']['@pDisposition'] != 'T':
                remove_required()
        except Exception:
            pass

    if key in {'@pTotalHCIFees', '@pTotalProfFees', '@pGrandTotal'}:
        try:
            if claim['CF2']['CONSUMPTION']['@pEnoughBenefits'] != 'Y':
                remove_required()
        except Exception:
            pass

    if key in {'@pTotalActualCharges', '@pDiscount', '@pPhilhealthBenefit', '@pTotalAmount'}:
        try:
            if claim['CF2']['CONSUMPTION']['@pEnoughBenefits'] != 'N':
                remove_required()
        except Exception:
            pass

    if key == '@pDoctorCoPay':
        try:
            copay = (claim['CF2']['PROFESSIONALS'][list_index] if list_index is not None
                     else claim['CF2']['PROFESSIONALS']).get('@pWithCoPay')
            if copay != 'Y':
                remove_required()
                violations[:] = [v for v in violations if not v.startswith("[Data Float Type]")]
        except Exception:
            pass

    if key == '@pFilterCardNo':
        try:
            if claim['CF2']['SPECIAL']['NCP'].get('@pNewbornScreeningTest') != 'Y':
                remove_required()
        except Exception:
            pass

    if key in {'@pDrying','@pSkinToSkin','@pCordClamping','@pProphylaxis','@pWeighing','@pVitaminK','@pBCG','@pNonSeparation','@pHepatitisB'}:
        try:
            ncp = claim['CF2']['SPECIAL']['NCP']
            if ncp.get('@pEssentialNewbornCare') != 'Y':
                remove_required()
            elif ncp.get('@pNewbornScreeningTest') == 'Y':
                add(_rule_format_values(data, {'Y', 'N'}))
        except Exception:
            pass

    if key == '@pDMSTotalAmount':
        try:
            if claim['CF2']['CONSUMPTION']['PURCHASES'].get('@pDrugsMedicinesSupplies') != 'Y':
                remove_required()
        except Exception:
            pass

    if key == '@pExamTotalAmount':
        try:
            if claim['CF2']['CONSUMPTION']['PURCHASES'].get('@pExaminations') != 'Y':
                remove_required()
        except Exception:
            pass

    if key == '@pReasonDesc':
        try:
            apr = claim['CF2']['APR']['APRBYPATREPSIG']
            reason_o = (
                ('DEFINEDREASONFORSIGNING' in apr and apr['DEFINEDREASONFORSIGNING'].get('@pReasonCode') == 'O') or
                ('OTHERREASONFORSIGNING'   in apr and apr['OTHERREASONFORSIGNING'].get('@pReasonCode')   == 'O')
            )
            if not reason_o:
                remove_required()
        except Exception:
            pass

    if key == '@pRelDesc':
        try:
            apr = claim['CF2']['APR']['APRBYPATREPSIG']
            rel_o = (
                ('DEFINEDPATREPREL' in apr and apr['DEFINEDPATREPREL'].get('@pRelCode') == 'O') or
                ('OTHERPATREPREL'   in apr and apr['OTHERPATREPREL'].get('@pRelCode')   == 'O')
            )
            if not rel_o:
                remove_required()
        except Exception:
            pass

    if key in {'@pICDCode', '@pRVSCode'} and 'ALLCASERATE > CASERATE' in str(xml_tree):
        try:
            caserate = (claim['ALLCASERATE']['CASERATE'][list_index] if list_index is not None
                        else claim['ALLCASERATE']['CASERATE'])
            other = '@pRVSCode' if key == '@pICDCode' else '@pICDCode'
            if caserate.get(other):
                remove_required()
        except Exception:
            pass

    return violations


# ── Special checks ────────────────────────────────────────────────────────────

def _check_patient_type_rule(claim_dict, xml_tree, results):
    admission_date = claim_dict.get('CF2', {}).get('@pAdmissionDate', '')
    discharge_date = claim_dict.get('CF2', {}).get('@pDischargeDate', '')
    patient_type   = claim_dict.get('@pPatientType', '')
    special        = claim_dict.get('CF2', {}).get('SPECIAL', {})
    procedures     = special.get('PROCEDURES', {}) if isinstance(special, dict) else {}
    has_repetitive = any(p in procedures for p in REPETITIVE_PROCEDURES) if isinstance(procedures, dict) else False

    if not (admission_date and discharge_date and patient_type):
        return
    try:
        from datetime import datetime as dt
        adm = dt.strptime(admission_date.strip(), '%m-%d-%Y')
        dis = dt.strptime(discharge_date.strip(), '%m-%d-%Y')
        if has_repetitive and patient_type == 'I':
            results.append({
                "field": xml_tree, "rule": "@pPatientType",
                "message": "[repetitiveProcedurePatientType] Claims with repetitive procedures must be filed as Outpatient (pPatientType=\"O\").",
                "line": None, "severity": "error",
            })
        elif not has_repetitive and adm == dis and patient_type == 'I':
            results.append({
                "field": xml_tree, "rule": "@pPatientType",
                "message": f"[sameDayOutpatientRule] Same admission/discharge date ({admission_date}) = < 24 hrs stay. Must be Outpatient (\"O\"), not Inpatient (\"I\"). (PhilHealth 24-hour rule)",
                "line": None, "severity": "error",
            })
    except ValueError:
        pass


# ── Traversal ────────────────────────────────────────────────────────────────

def _traverse(key, dict_data, claim, results, parent_key="", list_index=None):
    xml_tree = (parent_key + (f"[{list_index}]" if list_index is not None else "") + f" > {key}"
                if parent_key else key)

    val = dict_data.get(key)

    if isinstance(val, dict):
        if xml_tree == 'eCLAIMS > eTRANSMITTAL > CLAIM':
            if '@pClaimSeriesLhio' not in val:
                for v in _validate_field('@pClaimSeriesLhio', None, xml_tree, claim):
                    results.append({"field": xml_tree, "rule": "@pClaimSeriesLhio",
                                    "message": v, "line": None, "severity": "error"})
            _check_patient_type_rule(val, xml_tree, results)

        for sub_key in val:
            _traverse(sub_key, val, claim, results, xml_tree)

    elif isinstance(val, list):
        if key == 'CASERATE' and xml_tree == 'eCLAIMS > eTRANSMITTAL > CLAIM > ALLCASERATE':
            if len(val) > 2:
                results.append({
                    "field": xml_tree, "rule": "CASERATE",
                    "message": f"[maxCaseRates] Maximum 2 CASERATEs allowed (primary + 1 secondary). Found: {len(val)}. (PhilHealth Circular 2013-0014)",
                    "line": None, "severity": "error",
                })

        for idx, item in enumerate(val):
            if isinstance(item, dict):
                for sub_key in item:
                    _traverse(sub_key, item, claim, results, xml_tree, list_index=idx)

    else:
        attr_key = f"@{key}" if not key.startswith('@') else key
        for v in _validate_field(attr_key, val, xml_tree, claim, list_index=list_index):
            results.append({"field": xml_tree, "rule": attr_key,
                            "message": v, "line": None, "severity": "error"})


# ── Main entry point ──────────────────────────────────────────────────────────

def check_claim(filename: str, content: str) -> dict:
    errors = []
    xml_bytes = content.encode("utf-8") if isinstance(content, str) else content

    # 1. DTD structural validation
    if os.path.exists(DTD_PATH):
        try:
            dtd  = etree.DTD(file=DTD_PATH)
            tree = etree.fromstring(xml_bytes)
            if not dtd.validate(tree):
                for e in dtd.error_log:
                    errors.append({"field": "DTD", "rule": "dtd_structure",
                                   "message": e.message, "line": e.line, "severity": "error"})
        except etree.XMLSyntaxError as e:
            return {"filename": filename, "status": "fail", "errors": [{
                "field": "XML", "rule": "well_formed",
                "message": f"XML syntax error: {e}", "line": None, "severity": "error",
            }]}
    else:
        errors.append({"field": "DTD", "rule": "dtd_missing",
                       "message": "eClaimsDef.dtd not found — structural validation skipped",
                       "line": None, "severity": "warning"})

    # 2. Parse
    try:
        data = xmltodict.parse(content)
    except Exception as e:
        return {"filename": filename, "status": "fail", "errors": [{
            "field": "XML", "rule": "well_formed",
            "message": f"XML parse error: {e}", "line": None, "severity": "error",
        }]}

    if 'eCLAIMS' not in data:
        errors.append({"field": "root", "rule": "valid_root",
                       "message": "Root element must be <eCLAIMS>",
                       "line": 1, "severity": "error"})
        return {"filename": filename, "status": "fail", "errors": errors}

    # 3. Claim context
    try:
        raw = data['eCLAIMS']['eTRANSMITTAL']['CLAIM']
        claim = raw if isinstance(raw, dict) else raw[0]
    except Exception:
        claim = {}

    # 4. Traverse
    field_errors = []
    _traverse('eCLAIMS', data, claim, field_errors)
    errors.extend(field_errors)

    status = "fail" if any(e["severity"] == "error" for e in errors) else "pass"
    return {"filename": filename, "status": status, "errors": errors}
