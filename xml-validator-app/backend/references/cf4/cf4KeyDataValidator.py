import json 
from typing import List
import logging
from modules.rules import AppliedRule, ruleLength, ruleRequired, ruleRequiredYesNoFormat, ruleIntegerFormat, ruleFloatFormat, ruleRequiredDateTimeFormat, ruleRequiredFormatValues, ruleRequiredIf, ruleRequiredFormat, ruleAlphaOnly, ruleByteSize, updateRules, ruleInvalidValue, ruleRequiredFormatEmpty, ruleRequiredValue, ruleNotInPNFMedicine, ruleRequiredNotInValue

# ── UTF-8 BYTE SIZE HELPER ────────────────────────────────────────────────────
# The original ruleByteSize in rules.py uses len(data) which counts characters,
# not bytes. This means multi-byte characters like ñ, Ñ, accented letters, and
# special symbols pass the check even when they exceed Oracle VARCHAR2 byte limits.
# This local helper wraps ruleByteSize to pass the actual UTF-8 byte length
# instead, matching Oracle's VARCHAR2 BYTE semantics exactly.
# All existing logic in this file remains intact — only byte measurement changes.

def _byteLen(data: str) -> int:
    """Return the UTF-8 byte length of a string (same as Oracle VARCHAR2 BYTE)."""
    return len(data.encode('utf-8')) if data else 0

def _ruleByteSizeUTF8(data: str, byteSize: int):
    """
    Drop-in replacement for ruleByteSize that counts actual UTF-8 bytes.
    Returns the same AppliedRule object so all downstream logic is unaffected.
    """
    violation = ''
    dataByteSize = _byteLen(data)
    if dataByteSize > byteSize:
        logging.error(f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize} bytes (UTF-8)')
        if byteSize == 0:
            violation = f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize} bytes (UTF-8). Should be empty'
        else:
            violation = f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize} bytes (UTF-8)'
    return AppliedRule('Data Byte Size', violation, True if violation else False)

# ─────────────────────────────────────────────────────────────────────────────

DD_REQUIRED_KEYS = { 'EPCB > @pUsername','EPCB > @pHciAccreNo','EPCB > @pCertificationId','EPCB > ENLISTMENTS > ENLISTMENT > @pEClaimId','EPCB > ENLISTMENTS > ENLISTMENT > @pHciCaseNo','EPCB > ENLISTMENTS > ENLISTMENT > @pHciTransNo','EPCB > ENLISTMENTS > ENLISTMENT > @pEffYear','EPCB > ENLISTMENTS > ENLISTMENT > @pEnlistStat','EPCB > ENLISTMENTS > ENLISTMENT > @pEnlistDate','EPCB > ENLISTMENTS > ENLISTMENT > @pPackageType','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientPin','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientFname','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientLname','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientType','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientSex','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientContactno','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientDob','EPCB > ENLISTMENTS > ENLISTMENT > @pCivilStatus','EPCB > ENLISTMENTS > ENLISTMENT > @pWithConsent','EPCB > ENLISTMENTS > ENLISTMENT > @pWithLoa','EPCB > ENLISTMENTS > ENLISTMENT > @pWithDisability','EPCB > ENLISTMENTS > ENLISTMENT > @pDependentType','EPCB > ENLISTMENTS > ENLISTMENT > @pTransDate','EPCB > ENLISTMENTS > ENLISTMENT > @pCreatedBy','EPCB > ENLISTMENTS > ENLISTMENT > @pReportStatus','EPCB > ENLISTMENTS > ENLISTMENT > @pAvailFreeService','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientPin','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientFname','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientLname','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientType','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientSex','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientContactno','EPCB > ENLISTMENTS > ENLISTMENT > @pPatientDob','EPCB > ENLISTMENTS > ENLISTMENT > @pCivilStatus','EPCB > ENLISTMENTS > ENLISTMENT > @pWithConsent','EPCB > ENLISTMENTS > ENLISTMENT > @pWithLoa','EPCB > ENLISTMENTS > ENLISTMENT > @pWithDisability','EPCB > ENLISTMENTS > ENLISTMENT > @pDependentType','EPCB > ENLISTMENTS > ENLISTMENT > @pTransDate','EPCB > ENLISTMENTS > ENLISTMENT > @pCreatedBy','EPCB > ENLISTMENTS > ENLISTMENT > @pReportStatus','EPCB > ENLISTMENTS > ENLISTMENT > @pAvailFreeService','EPCB > PROFILING > PROFILE > @pHciTransNo','EPCB > PROFILING > PROFILE > @pHciCaseNo','EPCB > PROFILING > PROFILE > @pPatientPin','EPCB > PROFILING > PROFILE > @pProfDate','EPCB > PROFILING > PROFILE > @pEffYear','EPCB > PROFILING > PROFILE > @pProfileATC','EPCB > PROFILING > PROFILE > @pReportStatus','EPCB > PROFILING > PROFILE > OINFO > @pReportStatus','EPCB > PROFILING > PROFILE > MEDHIST > @pReportStatus','EPCB > PROFILING > PROFILE > MHSPECIFIC > @pSpecificDesc','EPCB > PROFILING > PROFILE > MHSPECIFIC > @pReportStatus','EPCB > PROFILING > PROFILE > SURGHIST > @pReportStatus','EPCB > PROFILING > PROFILE > FAMHIST > @pReportStatus','EPCB > PROFILING > PROFILE > FHSPECIFIC > @pReportStatus','EPCB > PROFILING > PROFILE > SOCHIST > @pReportStatus','EPCB > PROFILING > PROFILE > IMMUNIZATION > @pReportStatus','EPCB > PROFILING > PROFILE > MENSHIST > @pIsApplicable','EPCB > PROFILING > PROFILE > MENSHIST > @pReportStatus','EPCB > PROFILING > PROFILE > PREGHIST > @pReportStatus','EPCB > PROFILING > PROFILE > BLOODTYPE > @pReportStatus','EPCB > PROFILING > PROFILE > PEGENSURVEY > @pGenSurveyId','EPCB > PROFILING > PROFILE > PEGENSURVEY > @pReportStatus','EPCB > PROFILING > PROFILE > PEMISC > @pSkinId','EPCB > PROFILING > PROFILE > PEMISC > @pHeentId','EPCB > PROFILING > PROFILE > PEMISC > @pChestId','EPCB > PROFILING > PROFILE > PEMISC > @pHeartId','EPCB > PROFILING > PROFILE > PEMISC > @pAbdomenId','EPCB > PROFILING > PROFILE > PEMISC > @pNeuroId','EPCB > PROFILING > PROFILE > PEMISC > @pGuId','EPCB > PROFILING > PROFILE > PEMISC > @pReportStatus','EPCB > PROFILING > PROFILE > PESPECIFIC > @pReportStatus','EPCB > PROFILING > PROFILE > DIAGNOSTIC > @pDiagnosticId','EPCB > PROFILING > PROFILE > DIAGNOSTIC > @pReportStatus','EPCB > PROFILING > PROFILE > ADVICE > @pRemarks','EPCB > PROFILING > PROFILE > ADVICE > @pReportStatus','EPCB > PROFILING > PROFILE > NCDQANS > @pReportStatus','EPCB > SOAPS > SOAP > @pHciTransNo','EPCB > SOAPS > SOAP > @pHciCaseNo','EPCB > SOAPS > SOAP > @pPatientPin','EPCB > SOAPS > SOAP > @pPatientType','EPCB > SOAPS > SOAP > @pSoapDate','EPCB > SOAPS > SOAP > @pEffYear','EPCB > SOAPS > SOAP > @pSoapATC','EPCB > SOAPS > SOAP > @pReportStatus','EPCB > SOAPS > SOAP > SUBJECTIVE > @pChiefComplaint','EPCB > SOAPS > SOAP > SUBJECTIVE > @pIllnessHistory','EPCB > SOAPS > SOAP > SUBJECTIVE > @pSignsSymptoms','EPCB > SOAPS > SOAP > SUBJECTIVE > @pReportStatus','EPCB > SOAPS > SOAP > PEPERT > @pSystolic','EPCB > SOAPS > SOAP > PEPERT > @pDiastolic','EPCB > SOAPS > SOAP > PEPERT > @pHr','EPCB > SOAPS > SOAP > PEPERT > @pRr','EPCB > SOAPS > SOAP > PEPERT > @pTemp','EPCB > SOAPS > SOAP > PEPERT > @pHeight','EPCB > SOAPS > SOAP > PEPERT > @pWeight','EPCB > SOAPS > SOAP > PEPERT > @pReportStatus','EPCB > SOAPS > SOAP > ICDS > @pIcdCode','EPCB > SOAPS > SOAP > ICDS > @pReportStatus','EPCB > SOAPS > SOAP > MANAGEMENT > @pManagementId','EPCB > SOAPS > SOAP > MANAGEMENT > @pReportStatus','EPCB > SOAPS > SOAP > ADVICE > @pReportStatus','EPCB > COURSEWARDS > COURSEWARD > @pHciCaseNo','EPCB > COURSEWARDS > COURSEWARD > @pHciTransNo','EPCB > COURSEWARDS > COURSEWARD > @pDateAction','EPCB > COURSEWARDS > COURSEWARD > @pDoctorsAction','EPCB > COURSEWARDS > COURSEWARD > @pReportStatus','EPCB > LABRESULTS > LABRESULT > CBC > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > CBC > @pReportStatus','EPCB > LABRESULTS > LABRESULT > URINALYSIS > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > URINALYSIS > @pReportStatus','EPCB > LABRESULTS > LABRESULT > CHESTXRAY > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > CHESTXRAY > @pReportStatus','EPCB > LABRESULTS > LABRESULT > SPUTUM > @pDataCollection','EPCB > LABRESULTS > LABRESULT > SPUTUM > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > SPUTUM > @pReportStatus','EPCB > LABRESULTS > LABRESULT > LIPIDPROF > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > LIPIDPROF > @pReportStatus','EPCB > LABRESULTS > LABRESULT > FBS > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > FBS > @pReportStatus','EPCB > LABRESULTS > LABRESULT > ECG > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > ECG > @pReportStatus','EPCB > LABRESULTS > LABRESULT > FECALYSIS > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > FECALYSIS > @pReportStatus','EPCB > LABRESULTS > LABRESULT > PAPSSMEAR > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > PAPSSMEAR > @pReportStatus','EPCB > LABRESULTS > LABRESULT > OGTT > @pIsApplicable','EPCB > LABRESULTS > LABRESULT > OGTT > @pReportStatus','EPCB > MEDICINES > MEDICINE > @pHciCaseNo','EPCB > MEDICINES > MEDICINE > @pHciTransNo','EPCB > MEDICINES > MEDICINE > @pRoute','EPCB > MEDICINES > MEDICINE > @pQuantity','EPCB > MEDICINES > MEDICINE > @pTotalAmtPrice','EPCB > MEDICINES > MEDICINE > @pInstructionFrequency','EPCB > MEDICINES > MEDICINE > @pIsApplicable','EPCB > MEDICINES > MEDICINE > @pDateAdded','EPCB > MEDICINES > MEDICINE > @pModule','EPCB > MEDICINES > MEDICINE > @pReportStatus' }
DD_BYTE_SIZE_0 = { '@pPatientAddbrgy', '@pPatientAddmun', '@pPatientAddprov', '@pPatientAddreg', '@pPatientAddzipcode', '@pMemFname', '@pMemMname', '@pMemLname', '@pMemExtname', '@pMemDob', '@pPeriodDuration', '@pMensInterval', '@pPadsPerDay', '@pOnsetSexIc', '@pBirthCtrlMethod', '@pIsMenopause', '@pMenopauseAge', '@pMenarchePeriod','@pPassword','@pEnlistTotalCnt','@pProfileTotalCnt','@pSoapTotalCnt','@pEmrId','@pHciTransmittalNumber','@pMemPin','@pMemFname','@pMemMname','@pMemLname','@pMemExtname','@pMemDob','@pMemCat','@pMemNcat','@pPatientAddbrgy','@pPatientAddmun','@pPatientAddprov','@pPatientAddreg','@pPatientAddzipcode','@pPatientPob','@pPatientAge','@pPatientOccupation','@pPatientEducation','@pPatientReligion','@pPatientMotherMnln','@pPatientMotherMnmi','@pPatientMotherBday','@pPatientFatherFn','@pPatientFatherExtn','@pPatientMotherFn','@pPatientFatherBday','@pPatientMotherExtn','@pPatientFatherLn','@pPatientFatherMi','@pMdiseaseCode','@pSurgDesc','@pSurgDate','@pIsSmoker','@pNoCigpk','@pIsAdrinker','@pNoBottles','@pIllDrugUser','@pChildImmcode','@pYoungwImmcode','@pPregwImmcode','@pElderlyImmcode','@pOtherImm','@pMenarchePeriod','@pPeriodDuration','@pMensInterval','@pPadsPerDay','@pOnsetSexIc','@pBirthCtrlMethod','@pIsMenopause','@pMenopauseAge','@pDeliveryTyp','@pWPregIndhyp','@pWFamPlan','@pBloodType','@pBloodRh','@pRectalId','@pQid2_Yn','@pQid1_Yn','@pQid3_Yn','@pQid4_Yn','@pQid23_Yn','@pQid18_Yn','@pQid20_Yn','@pQid19_Fbsdate','@pQid14_Yn','@pQid15_Yn','@pQid21_Yn','@pQid5_Ynx','@pQid13_Yn','@pQid16_Yn','@pQid24_Yn','@pQid22_Proteindate','@pQid6_Yn','@pQid7_Yn','@pQid19_Yn','@pQid19_Fbsmmol','@pQid21_Ketondate','@pQid8_Yn','@pQid22_Proteinval','@pQid17_Abcde','@pQid21_Ketonval','@pQid9_Yn','@pQid20_Choledate','@pQid19_Fbsmg','@pQid20_Choleval','@pQid10_Yn','@pQid22_Yn','@pQid11_Yn','@pQid12_Yn','@pOthRemarks','@pVision','@pLength','@pHeadCirc','@pRectalRem','@pActualUnitPrice','@pInstructionQuantity','@pInstructionStrength','@pPrescPhysician','@pReferralFacility','@pLabDate','@pHematocrit','@pHemoglobinG','@pHemoglobinMmol','@pMhcPg','@pMhcFmol','@pMchcGhb','@pMchcMmol','@pMcvUm','@pMcvFl','@pWbc1000','@pWbc10','@pMyelocyte','@pNeutrophilsBnd','@pNeutrophilsSeg','@pLymphocytes','@pMonocytes','@pEosinophils','@pBasophils','@pPlatelet','@pCoPay','@pGravity','@pAppearance','@pColor','@pGlucose','@pProteins','@pKetones','@pPh','@pRbCells','@pWbCells','@pBacteria','@pCrystals','@pBladderCell','@pSquamousCell','@pTubularCell','@pBroadCasts','@pEpithelialCast','@pGranularCast','@pHyalineCast','@pRbcCast','@pWaxyCast','@pWcCast','@pAlbumin','@pPusCells','@pFindings','@pRemarksFindings','@pObservation','@pRemarksObservation','@pNoPlusses','@pLdl','@pHdl','@pTotal','@pCholesterol','@pTriglycerides','@pGlucoseMg','@pGlucoseMmol','@pConsistency','@pRbc','@pWbc','@pOva','@pParasite','@pBlood','@pOccultBlood','@pImpression','@pExamFastingMg','@pExamFastingMmol','@pExamOgttOneHrMg','@pExamOgttOneHrMmol','@pExamOgttTwoHrMg','@pExamOgttTwoHrMmol'}
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
    'EPCB > PROFILING > PROFILE > @pEffYear'
}
DD_BYTE_SIZE_1 = { '@pEnlistStat','@pPackageType','@pPatientSex','@pCivilStatus','@pWithConsent','@pWithLoa','@pWithDisability','@pDependentType','@pReportStatus','@pDataCollection' }
DD_BYTE_SIZE_2 = { '@pPatientType' }
DD_BYTE_SIZE_3 = { '@pSkinId','@pHeentId','@pChestId','@pHeartId','@pAbdomenId','@pNeuroId','@pGuId' }
DD_BYTE_SIZE_4 = { '@pEffYear','@pModule' }
DD_BYTE_SIZE_5 = { '@pGenericCode','@pSaltCode','@pStrengthCode','@pFormCode','@pUnitCode','@pPackageCode' }
DD_BYTE_SIZE_9 = { '@pHciAccreNo' }
DD_BYTE_SIZE_10 = { '@pProfileATC','@pSoapATC','@pIcdCode' }
DD_BYTE_SIZE_12 = { '@pPatientPin' }
DD_BYTE_SIZE_15 = { '@pPatientContactno' }
DD_BYTE_SIZE_21 = { '@pCertificationId','@pEClaimID','@pHciCaseNo','@pHciTransNo','@pClaimID','@pClaimsTransmittalID' }
DD_BYTE_SIZE_30 = { '@pUsername', '@pPatientMname','@pPatientLname', '@pPatientExtname','@pCreatedBy','@pDrugCode','@pPatientFname' }
DD_BYTE_SIZE_50 = { '@pInstructionFrequency' }
DD_BYTE_SIZE_500 = { '@pPainSite','@pGenericName','@pRoute' }
DD_BYTE_SIZE_2000 = { '@pSpecificDesc', '@pDeficiencyRemarks', '@pGenSurveyRem','@pRemarks','@pSkinRem','@pHeentRem','@pChestRem','@pHeartRem','@pAbdomenRem','@pNeuroRem','@pGuRem','@pChiefComplaint','@pIllnessHistory','@pOtherComplaint','@pSignsSymptoms','@pDoctorsAction' }
DD_YES_NO_NA_KEYS = { '@pWithConsent','@pWithLoa','@pWithDisability','@pAvailFreeService' }
DD_YES_NO_KEYS = { '@pIsApplicable' }
DD_DATE_FORMAT = { '@pTransDate','@pPatientDob','@pProfDate','@pLastMensPeriod','@pSoapDate','@pDateAdded','@pDateAction' }
DD_INTEGER_FORMAT = { '@pPregCnt','@pDeliveryCnt','@pFullTermCnt','@pPrematureCnt','@pAbortionCnt','@pLivChildrenCnt','@pHr','@pRr'}
DD_FLOAT_FORMAT = { '@pSystolic','@pDiastolic','@pTemp','@pHeight','@pWeight','@pActualUnitPrice'}

def cf4KeyDataValidator(key, data, cf4, xmlTree, listIndex=None, medLibData=None):
    try:
        appliedRules: List[AppliedRule] = []
        logging.info('----- > Validating < -----')
        logging.info(f'Key: {key} | Value: {data}')

        # if (key in DTD_REQUIRED_KEYS):
        #     appliedRules.append(ruleRequired(data))
        if (xmlTree in DD_REQUIRED_KEYS):
            appliedRules.append(ruleRequired(data))
        if (key in DD_BYTE_SIZE_0):
            appliedRules.append(_ruleByteSizeUTF8(data, 0))
        if (key in DD_BYTE_SIZE_0_SPECIFICS):
            appliedRules.append(_ruleByteSizeUTF8(data, 0))
            # logging.info(f"Checking key: {key} against DD_BYTE_SIZE_0_SPECIFICS: {DD_BYTE_SIZE_0_SPECIFICS}")  
        if (key in DD_BYTE_SIZE_1):
            appliedRules.append(_ruleByteSizeUTF8(data, 1))
        if (key in DD_BYTE_SIZE_2):
            appliedRules.append(_ruleByteSizeUTF8(data, 2))
        if (key in DD_BYTE_SIZE_3):
            appliedRules.append(_ruleByteSizeUTF8(data, 3))
            if data:
                appliedRules.append(ruleIntegerFormat(data))
        if (key in DD_BYTE_SIZE_4):
            appliedRules.append(_ruleByteSizeUTF8(data, 4))
        if (key in DD_BYTE_SIZE_5):
            appliedRules.append(_ruleByteSizeUTF8(data, 5))
        if (key in DD_BYTE_SIZE_9):
            appliedRules.append(_ruleByteSizeUTF8(data, 9))
        if (key in DD_BYTE_SIZE_10):
            appliedRules.append(_ruleByteSizeUTF8(data, 10))
        if (key in DD_BYTE_SIZE_12):
            appliedRules.append(_ruleByteSizeUTF8(data, 12))
        if (key in DD_BYTE_SIZE_15):
            appliedRules.append(_ruleByteSizeUTF8(data, 15))
        if (key in DD_BYTE_SIZE_21):
            appliedRules.append(_ruleByteSizeUTF8(data, 21))
        if (key in DD_BYTE_SIZE_30):
            appliedRules.append(_ruleByteSizeUTF8(data, 30))
        if (key in DD_BYTE_SIZE_50):
            appliedRules.append(_ruleByteSizeUTF8(data, 50))
        if (key in DD_BYTE_SIZE_500):
            appliedRules.append(_ruleByteSizeUTF8(data, 500))
        if (key in DD_BYTE_SIZE_2000):
            appliedRules.append(_ruleByteSizeUTF8(data, 2000))
        if (key in DD_YES_NO_KEYS):
            appliedRules.extend(ruleRequiredYesNoFormat(data))
        if (key in DD_YES_NO_NA_KEYS):
            appliedRules.append(ruleRequiredFormatValues(data, {'Y', 'N', 'X'}))
        if (key in DD_DATE_FORMAT):
            appliedRules.extend(ruleRequiredDateTimeFormat(data, isDate=True, dateFormat="YYYY-MM-DD"))
        if (key in DD_INTEGER_FORMAT):
            appliedRules.append(ruleIntegerFormat(data))
        if (key in DD_FLOAT_FORMAT):
            appliedRules.append(ruleFloatFormat(data))

        if (key in {'@pPregCnt','@pDeliveryCnt','@pFullTermCnt','@pPrematureCnt','@pAbortionCnt','@pLivChildrenCnt'}):
            if (cf4['PROFILING']['PROFILE']['MENSHIST']['@pIsApplicable'] == 'Y'):
                appliedRules.append(ruleRequiredIf('MENSHIST>@pIsApplicable', 'Y'))
                if appliedRules.count(ruleIntegerFormat(data)):
                    appliedRules.append(ruleIntegerFormat(data))
            else:
                appliedRules.append(_ruleByteSizeUTF8(data, 0))
                appliedRules = updateRules(appliedRules, ruleRequired(data))
                appliedRules = updateRules(appliedRules, ruleIntegerFormat(data))
        if (key == '@pLastMensPeriod'):
            if (cf4['PROFILING']['PROFILE']['MENSHIST']['@pIsApplicable'] == 'Y'):
                appliedRules.append(ruleRequiredIf('MENSHIST>@pIsApplicable', 'Y'))
            else:
                appliedRules.append(_ruleByteSizeUTF8(data, 0))
                appliedRules = updateRules(appliedRules, ruleRequired(data))
                appliedRules = updateRules(appliedRules, ruleRequiredDateTimeFormat(data, isDate=True, dateFormat="YYYY-MM-DD")[1])
        if (key == '@pPainSite'):
            appliedRules.append(ruleRequiredIf('Pain Element in Signs And Symptoms', '38'))
        if (key == '@pActualUnitPrice'):
            if (not data):
                appliedRules = updateRules(appliedRules, ruleFloatFormat(data))
        if (key == '@pGenSurveyRem'):
            if (cf4['PROFILING']['PROFILE']['PEGENSURVEY']['@pGenSurveyId'] == '2'):
                appliedRules.append(ruleRequiredIf('@pGenSurveyId', '2'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pPatientType'):
            appliedRules.append(ruleRequiredFormatValues(data, {'MM', 'DD', 'NM', ''}))
        if (key == '@pProfileATC'):
            if (not data):
                appliedRules.append(ruleRequiredFormatValues(data, {'CF4'}))
        if (key in {'@pHr','@pRr'}):
            appliedRules.append(ruleLength(data, 3))
            if appliedRules.count(ruleIntegerFormat(data)):
                appliedRules.append(ruleIntegerFormat(data))
        if (key in {'@pTemp','@Height','@Weight'}):
            if appliedRules.count(ruleFloatFormat(data)):
                appliedRules.append(ruleFloatFormat(data))
            if (key == '@pTemp'):
                appliedRules.append(ruleLength(data, 4))
            else:
                appliedRules.append(ruleLength(data, 6))
        if (key == '@pReportStatus'):
            appliedRules.append(ruleRequiredFormatValues(data, {'V', 'U', 'F'}))
        if (key == '@pSkinRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pSkinId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pHeentRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pHeentId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pChestRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pChestId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pHeartRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pHeartId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pAbdomenRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pAbdomenId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pNeuroRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pNeuroId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key == '@pGuRem'):
            if (listIndex != None and cf4['PROFILING']['PROFILE']['PEMISC'][listIndex]['@pGuId'] == 'Others'):
                appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        if (key in {'@pChiefComplaint', 'pIllnessHistory'}):
            appliedRules.append(ruleInvalidValue(data, regex='none|NA|not applicable|N/A'))
        if (key == '@pOtherComplaint'):
            if (not cf4['SOAPS']['SOAP']['SUBJECTIVE']['@pSignsSymptoms'].find('X')):
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        # if (key == '@pSignsSymptoms'):
        if (key == '@pPatientSex'):
            appliedRules.append(ruleRequiredFormatValues(data, {'M', 'F'}))
        if (key == '@pPatientContactno'):
            appliedRules.append(ruleRequiredFormatValues(data, {'NA'}))
        if (key == '@pCivilStatus'):
            if (not data):
                appliedRules.append(ruleRequiredFormatValues(data, {'U'}))
        if (key == '@pModule'):
            appliedRules.append(ruleRequiredFormatValues(data, {'CF4', 'HAS', 'SOAP'}))
        if (key == '@pDataCollection'):
            appliedRules.append(ruleRequiredFormatValues(data, {'X', '1', '2', '3', '4'}))

        if str(xmlTree).startswith('EPCB > MEDICINES > MEDICINE'):
            if cf4['MEDICINES']['MEDICINE'][listIndex]['@pIsApplicable'] == 'Y' if listIndex != None else cf4['MEDICINES']['MEDICINE']['@pIsApplicable'] == 'Y':
                if key == '@pRoute':
                    appliedRules.append(ruleRequiredNotInValue(data, {'na', 'NA', 'n/a', 'N/A'}))
                    appliedRules.append(ruleRequired(data))
                    appliedRules.append(_ruleByteSizeUTF8(data, 500))
                if key == '@pInstructionFrequency':
                    appliedRules.append(ruleLength(data, 50))
                    appliedRules.append(ruleRequiredNotInValue(data, {'na', 'NA', 'n/a', 'N/A'}))
                if medLibData:
                    if key == '@pGenericCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Gen Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Gen Code']))
                    if key == '@pSaltCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Salt Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Salt Code']))
                    if key == '@pFormCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Form Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Form Code']))
                    if key == '@pStrengthCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Strength Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Strength Code']))
                    if key == '@pUnitCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Unit Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Unit Code']))
                    if key == '@pPackageCode':
                        logging.info(f'Data: {data} | Med Lib Data: {medLibData["Package Code"]}')
                        appliedRules.append(ruleRequiredValue(data, medLibData['Package Code']))
                    if key == '@pTotalAmtPrice':
                        logging.info(f'Data for total amout price: {data} | ')
                        appliedRules.append(ruleRequiredFormat(data,r"^\d+(\.\d{1,2})?$"))
                        
                else:
                    if key == '@pDrugCode':
                        appliedRules.append(ruleNotInPNFMedicine(data))
                    if key == '@pGenericName':
                        appliedRules.append(ruleRequired(data))
                    if key == '@pGenericCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
                    if key == '@pSaltCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
                    if key == '@pFormCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
                    if key == '@pStrengthCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
                    if key == '@pUnitCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
                    if key == '@pPackageCode':
                        appliedRules.append(ruleRequiredFormatEmpty(data))
            else:
                if key == '@pGenericCode':
                    appliedRules.append(ruleRequiredValue(data, medLibData['Gen Code']))
                if key == '@pSaltCode':
                    appliedRules.append(ruleRequiredValue(data, medLibData['Salt Code']))
                if key == '@pFormCode':
                    appliedRules.append(ruleRequiredValue(data, medLibData['Form Code']))
                if key == '@pStrengthCode':
                    appliedRules.append(ruleRequiredValue(data, medLibData['Strength Code']))
                if key == '@pUnitCode':
                    appliedRules.append(ruleRequiredValue(data, medLibData['Unit Code']))
                if key == '@pRoute':
                    appliedRules.append(ruleRequiredValue(data, '-'))
                if key == '@pQuantity':
                    appliedRules.append(ruleRequiredValue(data, '0'))
                if key == '@pTotalAmtPrice':
                    appliedRules.append(ruleRequiredValue(data, '0'))
                if key == '@pInstructionFrequency':
                    appliedRules.append(ruleRequiredValue(data, '-'))
                
        # POST CHECKING
        if (key == '@pDateAdded' and xmlTree not in DD_REQUIRED_KEYS):
            appliedRules = updateRules(appliedRules, ruleRequiredDateTimeFormat(data, isDate=True, dateFormat="YYYY-MM-DD")[1])
        if (key == '@pModule' and xmlTree not in DD_REQUIRED_KEYS):
            appliedRules = updateRules(appliedRules, ruleRequiredFormatValues(data, {'CF4', 'HAS', 'SOAP'}))

        appliedRulesDictList = []
        ruleValidationPassed = True
        for rules in appliedRules:
            if (isinstance(rules, object)):
                if (rules.violated == True):
                    ruleValidationPassed = False
                appliedRulesDictList.append(rules.__dict__)
        return {
            'xmlTree': xmlTree,
            'key': key,
            'value': data,
            'passed': ruleValidationPassed,
            'appliedRules': json.loads(json.dumps(appliedRulesDictList))
        }
    except Exception as e:
        logging.error("Failed to process key %s | %s", key, data)