import json
from typing import List
import logging
from modules.rules import AppliedRule, ruleLength, ruleRequired, ruleRequiredYesNoFormat, ruleIntegerFormat, ruleFloatFormat, ruleRequiredDateTimeFormat, ruleRequiredDateTimeFormat, ruleRequiredFormatValues, ruleRequiredIf, ruleRequiredFormat, ruleAlphaOnly, updateRules, ruleNotInXML

DD_REQUIRED_KEYS = {
    # eCLAIMS header
    '@pUserName','@pUserPassword','@pHospitalCode','@pHospitalEmail',  # Bug1 fix: was missing comma before @pServiceProvider
    # eTRANSMITTAL
    '@pHospitalTransmittalNo','@pTotalClaims',
    # CLAIM
    '@pClaimNumber','@pTrackingNumber','@pPatientType','@pIsEmergency',  # added @pTrackingNumber
    # (pPhilhealthClaimType & pClaimSeriesLhio handled separately via enum/notInXML rules)
    '@pClaimSeriesLhio',
    # CF1 — member
    '@pMemberPIN','@pMemberLastName',
    '@pMemberFirstName',  # Bug2 fix: was '@pMemberFirstname' (lowercase n)
    '@pMemberSuffix',     # added — DTD #REQUIRED
    '@pMemberMiddleName','@pMemberBirthDate','@pMemberShipType','@pMailingAddress','@pZipCode','@pMemberSex',
    '@pLandlineNo','@pMobileNo','@pEmailAddress',  # added — all DTD #REQUIRED
    # CF1 — patient
    '@pPatientIs','@pPatientPIN',
    '@pPatientLastName','@pPatientFirstName','@pPatientMiddleName','@pPatientSuffix',  # added — DTD #REQUIRED
    '@pPatientBirthDate','@pPatientSex',
    '@pPEN','@pEmployerName',
    # CF2
    '@pPatientReferred','@pReferredIHCPAccreCode',
    '@pAdmissionDate','@pAdmissionTime','@pDischargeDate','@pDischargeTime',
    '@pDisposition',
    '@pExpiredDate','@pExpiredTime',  # added @pExpiredTime — DTD #REQUIRED
    '@pReferralIHCPAccreCode','@pReferralReasons','@pAccommodationType',
    # DIAGNOSIS / DISCHARGE
    '@pAdmissionDiagnosis','@pDischargeDiagnosis',
    # ICDCODE / RVSCODES
    '@pICDCode','@pRelatedProcedure','@pProcedureDate','@pLaterality',
    # SESSIONS
    '@pSessionDate',  # added — DTD #REQUIRED
    # MCP
    '@pCheckUpDate1','@pCheckUpDate2','@pCheckUpDate3','@pCheckUpDate4',  # added — DTD #REQUIRED
    # TBDOTS
    '@pTBType','@pNTPCardNo',  # added @pNTPCardNo — DTD #REQUIRED (was commented out)
    # ABP — all added, DTD #REQUIRED
    '@pDay0ARV','@pDay3ARV','@pDay7ARV','@pRIG','@pABPOthers','@pABPSpecify',
    # NCP
    '@pEssentialNewbornCare','@pNewbornHearingScreeningTest','@pNewbornScreeningTest','@pFilterCardNo',
    # HIVAIDS
    '@pLaboratoryNumber',  # added — DTD #REQUIRED
    # CATARACTINFO — all added, DTD #REQUIRED
    '@pCataractPreAuth','@pLeftEyeIOLStickerNumber','@pLeftEyeIOLExpiryDate',
    '@pRightEyeIOLStickerNumber','@pRightEyeIOLExpiryDate',
    # PROFESSIONALS
    '@pDoctorAccreCode','@pDoctorLastName','@pDoctorFirstName','@pDoctorMiddleName',
    '@pDoctorSuffix',     # added — DTD #REQUIRED
    '@pWithCoPay',
    '@pDoctorSignDate',   # added — DTD #REQUIRED
    # CONSUMPTION
    '@pEnoughBenefits',
    # APR — pDateSigned added for both APRBYPATSIG and APRBYPATREPSIG
    '@pDateSigned',
    # HCIFEES / PROFFEES
    '@pMemberPatient','@pHMO','@pOthers',
    # PURCHASES
    '@pDrugsMedicinesSupplies','@pExaminations',
    # CASERATE
    '@pCaseRateCode',
    '@pCaseRateAmount',   # added — DTD #REQUIRED, also float
    # ZBENEFIT
    '@pZBenefitCode',
    '@pPreAuthDate',      # added — DTD #REQUIRED
    # CF3_OLD
    '@pChiefComplaint',
    '@pBriefHistory',     # added — DTD #REQUIRED
    '@pCourseWard',       # added — DTD #REQUIRED
    '@pPertinentFindings',# added — DTD #REQUIRED
    # PRENATAL
    '@pMCPOrientation',
    '@pPrenatalConsultation',  # added — DTD #REQUIRED
    '@pExpectedDeliveryDate',  # added — DTD #REQUIRED
    # CLINICALHIST
    '@pVitalSigns','@pPregnancyLowRisk','@pLMP',
    '@pMenarcheAge',      # added — DTD #REQUIRED
    '@pObstetricG','@pObstetricP','@pObstetric_T','@pObstetric_P','@pObstetric_A','@pObstetric_L',  # added
    # OBSTETRIC
    '@pMultiplePregnancy','@pOvarianCyst','@pMyomaUteri','@pPlacentaPrevia',
    '@pMiscarriages','@pStillBirth','@pPreEclampsia','@pEclampsia','@pPrematureContraction',
    # MEDISURG
    '@pHypertension','@pHeartDisease','@pDiabetes','@pThyroidDisaster','@pObesity',
    '@pAsthma','@pEpilepsy','@pRenalDisease','@pBleedingDisorders','@pPreviousCS',
    '@pUterineMyomectomy',  # Bug3 fix: was '@pUrineMyomectomy'
    # CONSULTATION — added all, DTD #REQUIRED
    '@pVisitDate','@pAOGWeeks','@pWeight','@pCardiacRate','@pRespiratoryRate','@pBloodPressure','@pTemperature',
    # DELIVERY — added all missing, DTD #REQUIRED
    '@pDeliveryDate','@pDeliveryTime',
    '@pObstetricIndex','@pAOGLMP','@pDeliveryManner','@pPresentation','@pFetalOutcome',
    '@pSex','@pBirthWeight','@pAPGARScore','@pPostpartum',
    # POSTPARTUM Y/N fields
    '@pPerinealWoundCare','@pMaternalComplications','@pBreastFeeding',
    '@pFamilyPlanning','@pPlanningService','@pSurgicalSterilization','@pFollowupSchedule',
    # POSTPARTUM remarks — added, DTD #REQUIRED
    '@pPerinealRemarks','@pMaternalRemarks','@pBreastFeedingRemarks',
    '@pFamilyPlanningRemarks','@pPlanningServiceRemarks','@pSterilizationRemarks','@pFollowupScheduleRemarks',
    # ADMITREASON
    '@pIntensive','@pMaintenance',
    '@pReferredReason',   # added — DTD #REQUIRED
    # PHEX — all added, DTD #REQUIRED
    '@pBP','@pCR','@pRR','@pTemp','@pHEENT','@pChestLungs','@pCVS','@pAbdomen','@pGUIE','@pSkinExtremities','@pNeuroExam',
    # WARD — added missing
    '@pCourseDate',
    '@pFindings','@pAction',  # added — DTD #REQUIRED
    # DRGMED
    '@pGenericName','@pBrandName','@pPreparation',
    '@pDrugCode','@pPNDFCode',  # added — DTD #REQUIRED
    # XLSO
    '@pDiagnosticName',
    # RECEIPT — added all missing, DTD #REQUIRED
    '@pCompanyName','@pBIRPermitNumber','@pReceiptNumber','@pReceiptDate',
    # ITEM — added all, DTD #REQUIRED
    '@pDescription',
    # DOCUMENT — added, DTD #REQUIRED
    '@pDocumentType','@pDocumentURL',
}
DTD_YES_NO_KEYS = { '@pIsEmergency','@pPatientReferred','@pHasAttachedSOA','@pEssentialNewbornCare','@pNewbornHearingScreeningTest','@pWithCoPay','@pEnoughBenefits','@pMemberPatient','@pHMO','@pOthers','@pDrugsMedicinesSupplies','@pExaminations','@pMCPOrientation','@pVitalSigns','@pPregnancyLowRisk','@pMultiplePregnancy','@pOvarianCyst','@pMyomaUteri','@pPlacentaPrevia','@pMiscarriages','@pStillBirth','@pPreEclampsia','@pEclampsia','@pPrematureContraction','@pHypertension','@pHeartDisease','@pDiabetes','@pThyroidDisaster','@pObesity','@pAsthma','@pEpilepsy','@pRenalDisease','@pBleedingDisorders','@pPreviousCS','@pUterineMyomectomy','@pPerinealWoundCare','@pMaternalComplications','@pFamilyPlanning','@pBreastFeeding','@pPlanningService','@pSurgicalSterilization','@pFollowupSchedule','@pIntensive','@pMaintenance','@pHasAttachedSOA' }
GUIDELINE_LENGTH_1 = { '@pPatientType','@pReasonCode','@pMemberSex','@pPatientSex','@pSex','@pPatientIs','@pDisposition','@pAccommodationType','@pLaterality','@pTBType','@pNewbornHearingScreeningTestResult','@pNewbornScreeningTest','@pRelCode','@pThumbmarkedBy','@pAccommodationType','@pDrying','@pSkinToSkin','@pCordClamping','@pProphylaxis','@pWeighing','@pVitaminK','@pBCG','@pNonSeparation','@pHepatitisB' }
GUIDELINE_LENGTH_2 = { '@pMemberShipType','@pMenarcheAge' }
GUIDELINE_LENGTH_3 = { '@pTotalClaims','@pAOGWeeks','@pDocumentType','@pErrCode' }
GUIDELINE_LENGTH_4 = { '@pZipCode' }
GUIDELINE_LENGTH_5 = { '@pMemberSuffix','@pPatientSuffix','@pDoctorSuffix' }
GUIDELINE_LENGTH_6 = { '@pCaseRateCode','@pRVSCode' }
GUIDELINE_LENGTH_7 = { '@pZBenefitCode' }
GUIDELINE_LENGTH_10 = { '@pObstetricG','@pObstetricP','@pObstetric_T','@pObstetric_P','@pObstetric_A','@pObstetric_L','@pWeight','@pCardiacRate','@pRespiratoryRate','@pBloodPressure','@pTemperature','@pAPGARScore','@pNTPCardNo','@pRIG','@pABPOthers','@pBirthWeight','@pQuantity','@pVATExemptSale','@pVAT','@pTotal','@pUnitPrice','@pAmount' }
GUIDELINE_LENGTH_12 = { '@pHospitalCode','@pPIN','@pClaimNumber','@pDoctorAccreCode','@pDoctorCoPay','@pMemberPIN','@pPatientPIN','@pPEN','@pReferredIHCPAccreCode','@pReferralIHCPAccreCode','@pTotalHCIFees','@pTotalProfFees','@pGrandTotal','@pTotalActualCharges','@pDiscount','@pPhilhealthBenefit','@pTotalAmount','@pDMSTotalAmount','@pExamTotalAmount','@pCaseRateAmount' }
GUIDELINE_LENGTH_15 = { '@pClaimSeriesLhio','@pICDCode','@pCompanyTIN' }
GUIDELINE_LENGTH_18 = { '@pTransmissionControlNumber','@pReceiptTicketNumber' }
GUIDELINE_LENGTH_20 = { '@pUserName','@pUserPassword','@pCataractPreAuth','@pTrackingNumber','@pLandlineNo','@pMobileNo','@pNewbornHearingRegistryNo','@pLaboratoryNumber','@pBP','@pCR','@pRR','@pTemp','@pHEENT','@pChestLungs','@pCVS','@pAbdomen','@pGUIE','@pSkinExtremities','@pNeuroExam','@pDrugCode','@pPNDFCode','@pBIRPermitNumber','@pReceiptNumber','@pHospitalTransmittalNo','@pPhilhealthClaimType','@pFilterCardNo','@pDiagnosticType' }
GUIDELINE_LENGTH_30 = { '@pPreparation' }
GUIDELINE_LENGTH_50 = { '@pABPSpecify','@pObstetricIndex','@pAOGLMP','@pDeliveryManner','@pPresentation','@pFetalOutcome','@pServiceProvider','@pCertificateId','@pGenericName','@pBrandName','@pDiagnosticName','@pRelDesc','@pReasonDesc' }
GUIDELINE_LENGTH_60 = { '@pMemberLastName','@pMemberFirstName','@pMemberMiddleName','@pPatientLastName','@pPatientFirstName','@pPatientMiddleName','@pDoctorLastName','@pDoctorFirstName','@pDoctorMiddleName' }
GUIDELINE_LENGTH_100 = { '@pEmployerName','@pPerinealRemarks','@pMaternalRemarks','@pBreastFeedingRemarks','@pFamilyPlanningRemarks','@pPlanningServiceRemarks','@pSterilizationRemarks','@pFollowupScheduleRemarks','@pCompanyName','@pDescription','@pErrDescription' }
GUIDELINE_LENGTH_150 = { '@pHospitalEmail','@pMailingAddress','@pEmailAddress','@pRelatedProcedure','@pReferralReasons' }
GUIDELINE_LENGTH_200 = { '@pChiefComplaint','@pCriteria','@pFindings','@pAction' }
GUIDELINE_LENGTH_250 = { '@pDocumentURL' }
GUIDELINE_LENGTH_500 = { '@pAdmissionDiagnosis','@pDischargeDiagnosis','@pCourseWard','@pPertinentFindings','@pReferredReason' }
GUIDELINE_LENGTH_2500 = { '@pBriefHistory' }
# GUIDELINE_LENGTH_X = {  }
# GUIDELINE_LENGTH_X = {  }
GUIDELINE_INTEGER_FORMAT = { '@pTotalClaims','@pClaimSeriesLhio','@pMemberPIN','@pPatientPIN','@pZipCode','@pMenarcheAge','@pBirthWeight','@pQuantity' }
GUIDELINE_FLOAT_FORMAT = { '@pVATExemptSale','@pVAT','@pTotal','@pUnitPrice','@pAmount','@pDoctorCoPay','@pTotalHCIFees','@pTotalProfFees','@pGrandTotal','@pTotalActualCharges','@pDiscount','@pPhilhealthBenefit','@pTotalAmount','@pDMSTotalAmount','@pExamTotalAmount','@pCaseRateAmount' }
GUIDELINE_DATE_FORMAT = { '@pMemberBirthDate','@pPatientBirthDate','@pAdmissionDate','@pDischargeDate','@pProcedureDate','@pSessionDate','@pCheckUpDate1','@pCheckUpDate2','@pCheckUpDate3','@pCheckUpDate4','@pDay0ARV','@pDay3ARV','@pDay7ARV','@pDoctorSignDate','@pPrenatalConsultation','@pExpectedDeliveryDate','@pPregnancyLowRisk','@pLMP','@pVisitDate','@pDeliveryDate','@pPostpartum','@pCourseDate','@pPurchaseDate','@pDiagnosticDate','@pReceiptDate','@pTransmissionDate','@pReceivedDate','@pDateSigned','@pPreAuthDate','@pExpiredDate' }
GUIDELINE_TIME_FORMAT = { '@pAdmissionTime','@pDischargeTime','@pDeliveryTime','@pTransmissionTime','@pExpiredTime' }


def eClaimKeyDataValidator(key, data, claim, xmlTree, listIndex=None):
    logging.info('----- > Validating < -----')
    logging.info(f'Key: {key} | Value: {data}')
    appliedRules:List[AppliedRule] = []

    if (key in DD_REQUIRED_KEYS):
        appliedRules.append(ruleRequired(data))
    if (key in DTD_YES_NO_KEYS):
        appliedRules.extend(ruleRequiredYesNoFormat(data))
    if (key in GUIDELINE_LENGTH_20):
        appliedRules.append(ruleLength(data, 20))
    if (key in GUIDELINE_LENGTH_12):
        if ('@pClaimNumber' == key):
            appliedRules.append(ruleLength(str(data).replace('stash-', ''), 12))
        else:
            appliedRules.append(ruleLength(data, 12))
    if (key in GUIDELINE_LENGTH_150):
        appliedRules.append(ruleLength(data, 150))
    if (key in GUIDELINE_LENGTH_1):
        appliedRules.append(ruleLength(data, 1))
    if (key in GUIDELINE_LENGTH_3):
        appliedRules.append(ruleLength(data, 3))
    if (key in GUIDELINE_LENGTH_15):
        appliedRules.append(ruleLength(data, 15))
    if (key in GUIDELINE_LENGTH_60):
        appliedRules.append(ruleLength(data, 60))
    if (key in GUIDELINE_LENGTH_5):
        appliedRules.append(ruleLength(data, 5))
    if (key in GUIDELINE_LENGTH_100):
        appliedRules.append(ruleLength(data, 100))
    if (key in GUIDELINE_LENGTH_4):
        appliedRules.append(ruleLength(data, 4))
    if (key in GUIDELINE_LENGTH_2):
        appliedRules.append(ruleLength(data, 2))
    if (key in GUIDELINE_LENGTH_500):
        appliedRules.append(ruleLength(data, 500))
    if (key in GUIDELINE_LENGTH_50):
        appliedRules.append(ruleLength(data, 50))
    if (key in GUIDELINE_LENGTH_6):
        appliedRules.append(ruleLength(data, 6))
    if (key in GUIDELINE_LENGTH_7):
        appliedRules.append(ruleLength(data, 7))
    if (key in GUIDELINE_LENGTH_200):
        appliedRules.append(ruleLength(data, 200))
    if (key in GUIDELINE_LENGTH_250):
        appliedRules.append(ruleLength(data, 250))
    if (key in GUIDELINE_LENGTH_2500):
        appliedRules.append(ruleLength(data, 2500))
    if (key in GUIDELINE_LENGTH_10):
        appliedRules.append(ruleLength(data, 10))
    if (key in GUIDELINE_LENGTH_30):
        appliedRules.append(ruleLength(data, 30))
    if (key in GUIDELINE_LENGTH_18):
        appliedRules.append(ruleLength(data, 18))
    if (key in GUIDELINE_INTEGER_FORMAT):
        appliedRules.append(ruleIntegerFormat(data))
    if (key in GUIDELINE_FLOAT_FORMAT):
        appliedRules.append(ruleFloatFormat(data))
    if (key in GUIDELINE_DATE_FORMAT):
        appliedRules.extend(ruleRequiredDateTimeFormat(data=data, isDate=True))
    if (key in GUIDELINE_TIME_FORMAT):
        appliedRules.extend(ruleRequiredDateTimeFormat(data=data, isTime=True))

    if key == '@pClaimSeriesLhio' and not data:
        # Field absent or empty — only apply notInXML; skip integer/length rules which require a value
        appliedRules.append(ruleNotInXML())
        # Remove any required/integer/length rules that were added generically above,
        # since they will double-report on a field that is simply missing from the XML
        appliedRules = [r for r in appliedRules if not hasattr(r, 'rule') or r.rule not in ('required', 'integerFormat', 'length')]
    if (key in {'@pUserName','@pUserPassword','@pHospitalCode','@pHospitalEmail','@pServiceProvider','@pCertificateId'}):
        if ('@pClaimSeriesLhio' in claim and claim['@pClaimSeriesLhio'] != ''):
            appliedRules.append(ruleRequiredIf('@pClaimSeriesLhio', 'not NULL'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key in { '@pICDCode','@pRVSCode' } and str(xmlTree).find('eCLAIMS > eTRANSMITTAL > CLAIM > ALLCASERATE > CASERATE') != -1):
        if (listIndex != None):
            if (
                ('@pRVSCode' in claim['ALLCASERATE']['CASERATE'][listIndex] and claim['ALLCASERATE']['CASERATE'][listIndex]['@pRVSCode'] != "" and key == '@pICDCode') or
                ('@pICDCode' in claim['ALLCASERATE']['CASERATE'][listIndex] and claim['ALLCASERATE']['CASERATE'][listIndex]['@pICDCode'] != "" and key == '@pRVSCode')
                ):
                appliedRules = updateRules(appliedRules, ruleRequired(data))
        else:
            if (
                ('@pRVSCode' in claim['ALLCASERATE']['CASERATE'] and claim['ALLCASERATE']['CASERATE']['@pRVSCode'] != "" and key == '@pICDCode') or
                ('@pICDCode' in claim['ALLCASERATE']['CASERATE'] and claim['ALLCASERATE']['CASERATE']['@pICDCode'] != "" and key == '@pRVSCode')
                ):
                appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pPhilhealthClaimType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'ALL-CASE-RATE', 'Z-BENEFIT'}))
    if (key == '@pPatientType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'I', 'O'}))
    if (key == '@pMemberSex' or key == '@pPatientSex' or key == '@pSex'):
        appliedRules.append(ruleRequiredFormatValues(data, {'M', 'F'}))
    if (key == '@pPatientIs'):
        appliedRules.append(ruleRequiredFormatValues(data, {'M', 'S', 'C', 'P'}))
    if (key == '@pMemberShipType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'S', 'G', 'I', 'NS', 'NO', 'PS', 'PG', 'P'}))
    if (key == '@pDisposition'):
        appliedRules.append(ruleRequiredFormatValues(data, {'I', 'R', 'H', 'A', 'E', 'T'}))
    if (key == '@pExpiredDate'):
        if (claim['CF2']['@pDisposition'] == 'E'):
            appliedRules.extend(ruleRequiredDateTimeFormat(data=data, isDate=True))
    if (key == '@pAccommodationType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'P', 'N'}))
    if (key == '@pLaterality'):
        appliedRules.append(ruleRequiredFormatValues(data, {'L', 'R', 'B', 'N'}))
    if (key == '@pTBType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'I', 'M'}))
    if (key == '@pNewbornHearingScreeningTestResult'):
        appliedRules.append(ruleRequiredFormatValues(data, {'P', 'R', 'X'}))
    if (key in {'@pDrying','@pSkinToSkin','@pCordClamping','@pProphylaxis','@pWeighing','@pVitaminK','@pBCG','@pNonSeparation','@pHepatitisB'}):
        if (bool(claim['CF2']['SPECIAL'])):
            if 'NCP' in claim['CF2']['SPECIAL'] and claim['CF2']['SPECIAL']['NCP']['@pNewbornScreeningTest'] == 'Y':
                appliedRules.append(ruleRequiredFormatValues(data, {'Y', 'N'}))
    if (key in { '@pTotalHCIFees','@pTotalProfFees','@pGrandTotal' }):
        if (claim['CF2']['CONSUMPTION']['@pEnoughBenefits'] == 'Y'):
            appliedRules.append(ruleRequiredIf('@pEnoughBenefits', 'Y'))
            # appliedRules.append(ruleFloatFormat(data))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key in { '@pTotalActualCharges','@pDiscount','@pPhilhealthBenefit','@pTotalAmount' }):
        if (claim['CF2']['CONSUMPTION']['@pEnoughBenefits'] == 'N'):
            appliedRules.append(ruleRequiredIf('@pEnoughBenefits', 'N'))
            # appliedRules.append(ruleFloatFormat(data))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pDiagnosticType'):
        appliedRules.append(ruleRequiredFormatValues(data, {'IMAGING', 'LABORATORY', 'SUPPLIES', 'OTHERS'}))
    if (key == '@pRelCode'):
        appliedRules.append(ruleRequiredFormatValues(data, {'S', 'C', 'P', 'I', 'O'}))
    if (key == '@pThumbmarkedBy'):
        appliedRules.append(ruleRequiredFormatValues(data, {'P', 'R'}))
    if (key == '@pCompanyTIN'):
        appliedRules.append(ruleRequiredFormat(data, regex=r'^\d{3}-\d{3}-\d{3}-\d{3}$'))
    if (key == '@pDoctorAccreCode'):
        appliedRules.append(ruleRequiredFormat(data, regex=r'^\d{12}$'))
    if (key == '@pRelatedProcedure'):
        appliedRules.append(ruleAlphaOnly(data))
    if (key == '@pReasonDesc'):
        if (('DEFINEDREASONFORSIGNING' in claim['CF2']['APR']['APRBYPATREPSIG'] and claim['CF2']['APR']['APRBYPATREPSIG']['DEFINEDREASONFORSIGNING']['@pReasonCode'] == 'O') or ('OTHERREASONFORSIGNING' in claim['CF2']['APR']['APRBYPATREPSIG'] and claim['CF2']['APR']['APRBYPATREPSIG']['OTHERREASONFORSIGNING']['@pReasonCode'] == 'O')):
            appliedRules.append(ruleRequiredIf('@pReasonCode', 'O'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pDoctorCoPay'):
        if (listIndex != None):
            if (claim['CF2']['PROFESSIONALS'][listIndex]['@pWithCoPay'] == 'Y'):
                appliedRules.append(ruleRequiredIf('@pWithCoPay', 'Y'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
                appliedRules = updateRules(appliedRules, ruleFloatFormat(data))
        elif (claim['CF2']['PROFESSIONALS']['@pWithCoPay'] == 'Y'):
            appliedRules.append(ruleRequiredIf('@pWithCoPay', 'Y'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
            appliedRules = updateRules(appliedRules, ruleFloatFormat(data))
    if (key == '@pPatientLastName' or key == '@pPatientFirstName' or key == '@pPatientMiddleName'):
        if (claim['CF1']['@pPatientIs'] != 'M'):
            appliedRules.append(ruleRequiredIf('@pPatientIs', 'not M'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pPEN' or key == '@pEmployerName'):
        if (claim['CF1']['@pMemberShipType'] in { 'S', 'G' }):
            appliedRules.append(ruleRequiredIf('@pMemberShipType', 'S|G'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pReferredIHCPAccreCode'):
        if (claim['CF2']['@pPatientReferred'] == 'Y'):
            appliedRules.append(ruleRequiredIf('@pPatientReferred', 'Y'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pReferralIHCPAccreCode' or key == '@pReferralReasons'):
        if (claim['CF2']['@pDisposition'] == 'T'):
            appliedRules.append(ruleRequiredIf('@pDisposition', 'T'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    # if (key == '@pNTPCardNo' or key == '@pTBType'):
    #     if (claim['CF2']['SPECIAL']['TBDOTS']):
    #         appliedRules.append(ruleRequiredIf('TBDOTS', True))
    #     else:
    #         appliedRules.remove(ruleRequired(data))
    if (key == '@pFilterCardNo'):
        if (bool(claim['CF2']['SPECIAL'])):
            if (claim['CF2']['SPECIAL']['NCP']['@pNewbornScreeningTest'] == 'Y'):
                appliedRules.append(ruleRequiredIf('@pNewbornScreeningTest', 'Y'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
    if(key in { '@pDrying','@pSkinToSkin','@pCordClamping','@pProphylaxis','@pWeighing','@pVitaminK','@pBCG','@pNonSeparation','@pHepatitisB' }):
        if (bool(claim['CF2']['SPECIAL'])):
            if (claim['CF2']['SPECIAL']['NCP']['@pEssentialNewbornCare'] == 'Y'):
                appliedRules.append(ruleRequiredIf('@pEssentialNewbornCare', 'Y'))
            else:
                appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pDMSTotalAmount'):
        if (claim['CF2']['CONSUMPTION']['PURCHASES']['@pDrugsMedicinesSupplies'] == 'Y'):
            appliedRules.append(ruleRequiredIf('@pDrugsMedicinesSupplies', 'Y'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pExamTotalAmount'):
        if (claim['CF2']['CONSUMPTION']['PURCHASES']['@pExaminations'] == 'Y'):
            appliedRules.append(ruleRequiredIf('@pExaminations', 'Y'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    if (key == '@pRelDesc'):
        if (('DEFINEDPATREPREL' in claim['CF2']['APR']['APRBYPATREPSIG'] and claim['CF2']['APR']['APRBYPATREPSIG']['DEFINEDPATREPREL']['@pRelCode'] == 'O') or
            ('OTHERPATREPREL' in claim['CF2']['APR']['APRBYPATREPSIG'] and claim['CF2']['APR']['APRBYPATREPSIG']['OTHERPATREPREL']['@pRelCode'] == 'O')):
            appliedRules.append(ruleRequiredIf('@pRelCode', 'O'))
        else:
            appliedRules = updateRules(appliedRules, ruleRequired(data))
    # Fix #1: full Z-Benefit code enum from PECWS 3.0 DTD
    if (key == '@pZBenefitCode'):
        appliedRules.append(ruleRequiredFormatValues(data, {
            'Z0011','Z0012','Z0013',
            'Z0021','Z0022',
            'Z003',
            'Z0041','Z0042',
            'Z0051','Z0052',
            'Z0061','Z0062',
            'Z0071','Z0072',
            'Z0081','Z0082',
            'Z0091','Z0092'
        }))
    # Fix #7: validate ICD-10 code format — letter + 2 digits + optional .digit(s)
    if (key == '@pICDCode') and data:
        appliedRules.append(ruleRequiredFormat(data, regex=r'^[A-Z]\d{2}\.?\d{0,2}$'))
    # Fix #2: OTHERPATREPREL.pRelCode is DTD FIXED "O" — enforce strictly by xmlTree context
    if (key == '@pRelCode') and data:
        if 'OTHERPATREPREL' in str(xmlTree):
            appliedRules.append(ruleRequiredFormatValues(data, {'O'}))
    # Fix #3: @pReasonCode enum per parent element context (DTD-defined)
    #   DEFINEDREASONFORSIGNING.pReasonCode = (I) — only "I" is valid
    #   OTHERREASONFORSIGNING.pReasonCode   = FIXED "O"
    if (key == '@pReasonCode') and data:
        if 'DEFINEDREASONFORSIGNING' in str(xmlTree):
            appliedRules.append(ruleRequiredFormatValues(data, {'I'}))
        elif 'OTHERREASONFORSIGNING' in str(xmlTree):
            appliedRules.append(ruleRequiredFormatValues(data, {'O'}))

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
