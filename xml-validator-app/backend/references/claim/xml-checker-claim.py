import os
from datetime import datetime, timedelta
import pytz
import pandas as pd
import xmltodict
import logging
from eClaimKeyDataValidator import eClaimKeyDataValidator
from cf4KeyDataValidator import cf4KeyDataValidator
import json
from lxml import etree
import sys
from tqdm import tqdm
import tempfile
import requests

cf4DTD = 'dtd/EPCB.dtd'
eclaimDTD = 'dtd/eClaimsDef.dtd'
xmlPrefix = '@p'
isCF4 = False
medLib = list()

tzDT = datetime.now().utcnow() + timedelta(hours=8)
logFileName = tzDT.isoformat() + '.log'
logging.basicConfig(filename='logs/' + logFileName.replace(':', '_'), encoding='utf-8', level=logging.DEBUG)

# subclass JSONEncoder
class DateTimeEncoder(json.JSONEncoder):
    #Override the default method
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
    
def save_results(results, json_filename):
    with open(f'output/{json_filename}', 'w+') as results_file:
        results_file.write(json.dumps(results, indent=2))
        
def getKey(key):
    return xmlPrefix + key

def xml_to_json(file_location):
	with open(file_location, encoding='utf-8') as xml_file:
		data_dict = xmltodict.parse(xml_file.read())
		xml_file.close()
		return data_dict

def med_lib_json():
    medLibPd = pd.read_excel('modules/lib_medicine.xlsx', header=0, dtype={ 'Drug Code': str, 'Drug Description': str, 'Gen Code': str, 'Salt Code': str, 'Form Code': str, 'Strength Code': str, 'Unit Code': str, 'Package Code': str })
    return json.loads(medLibPd.to_json(orient="table", index=False))['data']

def searchMed(drugCode):
    for med in medLib:
        if med['Drug Code'] == drugCode:
            return med
    return None

def main():
    global isCF4, cf4DTD, eclaimDTD, medLib
    json_path = 'F:/TMC'
    json_filename = 'CF4_XML_ERROR.json'
    failed_results_file = "FAILED_CLAIMS-" + json_filename
    json_data = {}
    with open(os.path.join(json_path, json_filename), 'r') as jsonfile:
        json_data = json.loads(jsonfile.read())

    results = []
    failed_results = []
    for claim in tqdm(json_data, desc="Claims: "):
        submitted_date = datetime.strptime(claim['submittedDate']['$date'].replace('Z', '+0000'), "%Y-%m-%dT%H:%M:%S.%f%z") if str(claim['submittedDate']['$date']).find('.') != -1 else datetime.strptime(claim['submittedDate']['$date'].replace('Z', '+0000'), "%Y-%m-%dT%H:%M:%S%z")
        claim_results = {
            'id': claim['_id'],
            'claimNumber': claim['claimNumber'],
            'series': claim['series'],
            'hospitalUuid': claim['hospitalUuid'],
            'submittedDate': (submitted_date.astimezone(tz=pytz.utc)).astimezone(pytz.timezone('Asia/Manila')).strftime("%Y-%m-%d %H:%M:%S%z"),
            'caseRates': [],
            'cf4XmlCheckerReport': {},
            'claimXmlCheckerReport': {}
        }
        for caseRate in claim["allCaseRates"]["caseRates"]:
            claim_results["caseRates"].append({ "code": caseRate["code"], "isSetToOne": caseRate["code"] == "1" })
        for document in tqdm(claim['documents']['document'], desc="Documents: "):
            if not str(document['url']).endswith('.xml.enc'):
                continue
            url = document['url']
            raw_file_url = str(url).replace('.enc', '')
            if not str(url).startswith('https://file.stash.ph/philhealth/files/documents/') or not str(document['url']).endswith('.xml.enc'):
                continue
            temp_str = str(raw_file_url).split('/')
            temp_str.reverse()
            data_json = {}
            try:
                file_response = requests.get(raw_file_url, timeout=(30, 60))
                with open(f'xml/{temp_str[0]}', 'wb+') as results_file:
                    results_file.write(file_response.content)
                    results_file.seek(0)
                    data_json = xmltodict.parse(results_file.read().decode('utf-8'))
                    results_file.tell()
                # with tempfile.NamedTemporaryFile(delete=True) as temp_file:
                #     temp_file.write(file_response.content)
                #     temp_file.seek(0)
                #     data_json = xmltodict.parse(temp_file.read().decode('utf-8'))
                #     temp_file.tell()
            except Exception as e:
                logging.error(f'Failed to process file {claim["claimNumber"]} | {str(e)}')
                failed_results.append(claim)
                save_results(failed_results, failed_results_file)
            file_location = os.path.join('xml', temp_str[0])
            xmlKeysResults = []
            cf4Validator = etree.DTD(file=cf4DTD)
            eClaimValidator = etree.DTD(file=eclaimDTD)
            dtdErrorLog = None
            for keyLvl1 in data_json:
                if (keyLvl1 == 'EPCB'):
                    isCF4 = True
                    medLib = med_lib_json()
                    cf4Xml = etree.parse(file_location)
                    isCF4Valid = cf4Validator.validate(cf4Xml)
                    dtdErrorLog = cf4Validator.error_log
                    dtdErrorLogList = []
                    for dtdError in dtdErrorLog:
                        dtdErrorLogList.append(dtdError.message)
                    claim_results['cf4XmlCheckerReport'] = { 'dtdValidated': isCF4Valid, 'dtdErrorLog': dtdErrorLogList, 'file': url, 'failed': [] }
                    xmlKeysResults = traverseXMLKeys(keyLvl1, data_json, claimForm=data_json['EPCB'] if 'EPCB' in data_json else None, results=xmlKeysResults)
                else:
                    isCF4 = False
                    eClaimXml = etree.parse(file_location)
                    iseClaimValid = eClaimValidator.validate(eClaimXml)
                    dtdErrorLog = eClaimValidator.error_log
                    dtdErrorLogList = []
                    for dtdError in dtdErrorLog:
                        dtdErrorLogList.append(dtdError.message)
                    claim_results['claimXmlCheckerReport'] = { 'dtdValidated': iseClaimValid, 'dtdErrorLog': dtdErrorLogList, 'file': url, 'failed': [] }
                    xmlKeysResults = traverseXMLKeys(keyLvl1, data_json, claimForm=data_json['eCLAIMS']['eTRANSMITTAL']['CLAIM'] if 'eCLAIMS' in data_json else None, results=xmlKeysResults)

            # Fix #8: only append genuinely failed items (passed == False),
            # and route to the correct report depending on XML type (CF4 vs eClaims)
            for item in xmlKeysResults:
                if not item.get('passed', True):
                    if isCF4:
                        claim_results['cf4XmlCheckerReport']['failed'].append(item)
                    else:
                        claim_results['claimXmlCheckerReport']['failed'].append(item)
        results.append(claim_results)
        save_results(results, json_filename)

def traverseXMLKeys(key, dictdata, claimForm, results, parentKey="", listIndex=None, medLibData=None):
    logging.info('----- > (Key | Type) Checking < -----')
    if (parentKey):
        logging.info(f'{parentKey}{("[" + str(listIndex) + "]") if listIndex != None else ""} > {key}')
        logging.info(f'isKeyDict: {isinstance(dictdata[key],dict)} - isKeyList: {isinstance(dictdata[key],list)}')
        parentKey += ("[" + str(listIndex) + "]" if listIndex != None else "") + ' > ' + key
    else:
        logging.info(f'{key}')
        logging.info(f'isKeyDict: {isinstance(dictdata[key],dict)} - isKeyList: {isinstance(dictdata[key],list)}')
        parentKey = key
    isMedicines = str(parentKey) == 'EPCB > MEDICINES > MEDICINE'
    if (isinstance(dictdata[key],dict)):
        if isMedicines:
            medLibData = searchMed(dictdata[key]['@pDrugCode'])
        if str(parentKey) == 'eCLAIMS > eTRANSMITTAL > CLAIM':
            if '@pClaimSeriesLhio' not in dictdata[key]:
                results.append(eClaimKeyDataValidator('@pClaimSeriesLhio', None, claimForm, parentKey, listIndex=listIndex))
            # ----------------------------------------------------------------
            # Rule: 24-hour / patient type consistency check
            # PhilHealth policy: a stay where admission date == discharge date
            # (same-day, i.e. < 24 hours) must be filed as Outpatient ('O').
            # Exception: claims with repetitive procedures under SPECIAL >
            # PROCEDURES (HEMODIALYSIS, PERITONEAL, LINAC, COBALT, TRANSFUSION,
            # BRACHYTHERAPHY, CHEMOTHERAPY, DEBRIDEMENT, IMRT) are always filed
            # as Outpatient regardless of the date span, because hospitals submit
            # them in bulk covering multiple sessions — admission = first session,
            # discharge = last session, but pPatientType must still be 'O'.
            # ----------------------------------------------------------------
            claim_dict = dictdata[key]
            admission_date  = claim_dict.get('CF2', {}).get('@pAdmissionDate', '')
            discharge_date  = claim_dict.get('CF2', {}).get('@pDischargeDate', '')
            patient_type    = claim_dict.get('@pPatientType', '')
            special_section = claim_dict.get('CF2', {}).get('SPECIAL', {})

            # Detect whether any repetitive procedure is present
            REPETITIVE_PROCEDURES = {
                'HEMODIALYSIS','PERITONEAL','LINAC','COBALT',
                'TRANSFUSION','BRACHYTHERAPHY','CHEMOTHERAPY',
                'DEBRIDEMENT','IMRT'
            }
            procedures_block = special_section.get('PROCEDURES', {}) if isinstance(special_section, dict) else {}
            has_repetitive_procedure = any(
                proc in procedures_block for proc in REPETITIVE_PROCEDURES
            ) if isinstance(procedures_block, dict) else False

            if admission_date and discharge_date and patient_type:
                try:
                    from datetime import datetime as dt
                    adm = dt.strptime(admission_date.strip(), '%m-%d-%Y')
                    dis = dt.strptime(discharge_date.strip(), '%m-%d-%Y')

                    # Rule 1 — Repetitive procedure claims must always be Outpatient
                    if has_repetitive_procedure and patient_type == 'I':
                        results.append({
                            'xmlTree': parentKey,
                            'key': '@pPatientType',
                            'value': patient_type,
                            'passed': False,
                            'appliedRules': [{
                                'rule': 'repetitiveProcedurePatientType',
                                'violated': True,
                                'message': (
                                    f'Claims with repetitive procedures (HEMODIALYSIS, CHEMOTHERAPY, etc.) '
                                    f'must be filed as Outpatient (pPatientType="O"). '
                                    f'Found: "{patient_type}". Hospitals submit these in bulk covering '
                                    f'multiple sessions; admission/discharge span does not make them Inpatient.'
                                )
                            }]
                        })
                        logging.warning(f'Repetitive procedure patient type violation in {parentKey}')

                    # Rule 2 — Same-day (< 24 hrs) stay must be Outpatient, unless repetitive procedure
                    elif not has_repetitive_procedure and adm == dis and patient_type == 'I':
                        results.append({
                            'xmlTree': parentKey,
                            'key': '@pPatientType',
                            'value': patient_type,
                            'passed': False,
                            'appliedRules': [{
                                'rule': 'sameDayOutpatientRule',
                                'violated': True,
                                'message': (
                                    f'Admission date and discharge date are the same ({admission_date}), '
                                    f'indicating a stay of less than 24 hours. '
                                    f'This must be filed as Outpatient (pPatientType="O"), '
                                    f'not Inpatient ("I"). (PhilHealth 24-hour rule)'
                                )
                            }]
                        })
                        logging.warning(f'Same-day inpatient violation in {parentKey}: adm={admission_date} dis={discharge_date}')

                except ValueError:
                    logging.warning(f'Could not parse admission/discharge dates for patient type check: adm={admission_date} dis={discharge_date}')
        for keyLvl2 in dictdata[key]:
            if isMedicines:
                results = traverseXMLKeys(keyLvl2, dictdata[key], claimForm=claimForm, results=results, parentKey=parentKey, medLibData=medLibData)
            else:
                results = traverseXMLKeys(keyLvl2, dictdata[key], claimForm=claimForm, results=results, parentKey=parentKey)
    elif (isinstance(dictdata[key], list)):
        # PhilHealth All Case Rate policy (Circular 2013-0014):
        # A claim may only have a primary and one secondary case rate — maximum 2 CASERATEs.
        # DTD allows CASERATE+ (one or more) but the oracle enforces max 2 at business rule level.
        if key == 'CASERATE' and str(parentKey) == 'eCLAIMS > eTRANSMITTAL > CLAIM > ALLCASERATE':
            caserate_count = len(dictdata[key])
            if caserate_count > 2:
                results.append({
                    'xmlTree': parentKey,
                    'key': 'CASERATE',
                    'value': f'{caserate_count} case rates found',
                    'passed': False,
                    'appliedRules': [{
                        'rule': 'maxCaseRates',
                        'violated': True,
                        'message': f'Maximum of 2 CASERATEs allowed per claim (primary + 1 secondary). Found: {caserate_count}. (PhilHealth Circular 2013-0014)'
                    }]
                })
                logging.warning(f'CASERATE count violation: {caserate_count} case rates found in {parentKey}')
        for idx, listItem in enumerate(dictdata[key]):
            if isMedicines:
                medLibData = searchMed(listItem['@pDrugCode'])
            for keyLvl2 in listItem:
                if isMedicines:
                    results = traverseXMLKeys(keyLvl2, listItem, claimForm=claimForm, results=results, parentKey=parentKey, listIndex=idx, medLibData=medLibData)
                else:
                    results = traverseXMLKeys(keyLvl2, listItem, claimForm=claimForm, results=results, parentKey=parentKey, listIndex=idx)
    else:
        result = None
        if (isCF4):
            if medLibData:
                result = cf4KeyDataValidator(key, dictdata[key], claimForm, parentKey, listIndex=listIndex, medLibData=medLibData)
            else:
                result = cf4KeyDataValidator(key, dictdata[key], claimForm, parentKey, listIndex=listIndex)
        else:
            result = eClaimKeyDataValidator(key, dictdata[key], claimForm, parentKey, listIndex=listIndex)
        results.append(result)
    return results

main()