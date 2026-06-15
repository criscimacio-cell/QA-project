import os
from datetime import datetime, timedelta
import pandas as pd
import xmltodict
import logging
from eClaimKeyDataValidator import eClaimKeyDataValidator
from cf4KeyDataValidator import cf4KeyDataValidator
import json
from lxml import etree
import sys
from tqdm import tqdm

directory = 'xml/'
cf4DTD = 'dtd/EPCB.dtd'
eclaimDTD = 'dtd/eClaimsDef.dtd'
xmlPrefix = '@p'
isCF4 = False
medLib = list()

tzDT = datetime.now().utcnow() + timedelta(hours=8)
logFileName = tzDT.isoformat() + '.log'
logging.basicConfig(filename='logs/' + logFileName.replace(':', '_'), encoding='utf-8', level=logging.DEBUG)

def getKey(key):
    return xmlPrefix + key

def xml_to_json(file_location):
    try:
        with open(file_location, encoding='utf-8') as xml_file:
            data_dict = xmltodict.parse(xml_file.read())
            return data_dict
    except Exception as e:
        print(f"❌ Failed parsing {file_location}: {e}")

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
    args = list(map(str.lower, sys.argv))
    converted_xml_data = []
    isUrl = 'url' in args
    if isUrl:
        converted_xml_data = processFilesFromS3()
    else:
        converted_xml_data = processFilesFromDirectory()
    for xml_data in tqdm(converted_xml_data, desc="CF4: "):
        file = xml_data["url"] if isUrl else xml_data["filename"]
        file_location = xml_data["url"] if isUrl else os.path.join(directory, xml_data["filename"])
        data_json = xml_data["data"]
        results = {}
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
                results = { 'dtdValidated': isCF4Valid, 'dtdErrorLog': dtdErrorLogList, 'file': file, 'passed': [], 'failed': [] }
                xmlKeysResults = traverseXMLKeys(keyLvl1, data_json, claimForm=data_json['EPCB'] if 'EPCB' in data_json else None, results=xmlKeysResults)
            else:
                isCF4 = False
                eClaimXml = etree.parse(file_location)
                iseClaimValid = eClaimValidator.validate(eClaimXml)
                dtdErrorLog = eClaimValidator.error_log
                dtdErrorLogList = []
                for dtdError in dtdErrorLog:
                    dtdErrorLogList.append(dtdError.message)
                results = { 'dtdValidated': iseClaimValid, 'dtdErrorLog': dtdErrorLogList, 'file': file, 'failed': [], 'passed': [] }
                xmlKeysResults = traverseXMLKeys(keyLvl1, data_json, claimForm=data_json['eCLAIMS']['eTRANSMITTAL']['CLAIM'] if 'eCLAIMS' in data_json else None, results=xmlKeysResults)

        for item in xmlKeysResults:
            if ('passed' in item):
                if (item['passed']):
                    results['passed'].append(item)
                else:
                    results['failed'].append(item)

        resultsFolder = datetime.now().strftime('%Y-%m-%dT%H%M')
        isExist = os.path.exists(f'results/{resultsFolder}')
        if (not isExist):
            os.makedirs(f'results/{resultsFolder}', exist_ok=False)
        with open(f'results/{resultsFolder}/{file}.json', 'w+') as results_file:
            results_file.write(json.dumps(results, indent=2))

def processFilesFromS3():
    return []

# def processFilesFromDirectory():
#     converted_xml_files = []
#     for idx, filename in enumerate(os.listdir(directory)):
#         file_location = os.path.join(directory, filename)
#         extn = filename.split('.').pop()
#         logging.info('------------ > FILE < ------------')
#         logging.info(f'File Location: {file_location}')
#         if (extn != 'xml'):
#             logging.warning(f'File not valid: {file_location}')
#             continue
#         converted_xml_files.append({ "filename": filename, "data": xml_to_json(file_location) })
#     return converted_xml_files

def processFilesFromDirectory():
    converted_xml_files = []
    error_folder = os.path.join(directory, "xml-with-error")
    os.makedirs(error_folder, exist_ok=True)  # make sure folder exists

    for idx, filename in enumerate(os.listdir(directory)):
        file_location = os.path.join(directory, filename)
        extn = filename.split('.').pop()
        logging.info('------------ > FILE < ------------')
        logging.info(f'File Location: {file_location}')
        
        if extn.lower() != 'xml':
            logging.warning(f'File not valid: {file_location}')
            continue

        parsed = xml_to_json(file_location)

        # ✅ If parsing succeeded
        if isinstance(parsed, dict):
            converted_xml_files.append({
                "filename": filename,
                "data": parsed
            })
        else:
            # parsed contains the error message string
            error_message = parsed  
            logging.error(error_message)

            # 1. Move the file into xml-with-error folder
            new_location = os.path.join(error_folder, filename)

            # 2. Inject <errormsg> tag into the file
            try:
                with open(file_location, "r", encoding="utf-8") as f:
                    original_content = f.read()
            except Exception:
                original_content = ""

            # Add the error message as the first line
            error_xml = f"<errormsg error='{error_message}'></errormsg>\n{original_content}"

            # Save the modified XML into the error folder
            with open(new_location, "w", encoding="utf-8") as f:
                f.write(error_xml)

            # Remove the original file
            os.remove(file_location)

    return converted_xml_files


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
        for keyLvl2 in dictdata[key]:
            if isMedicines:
                results = traverseXMLKeys(keyLvl2, dictdata[key], claimForm=claimForm, results=results, parentKey=parentKey, medLibData=medLibData)
            else:
                results = traverseXMLKeys(keyLvl2, dictdata[key], claimForm=claimForm, results=results, parentKey=parentKey)
    elif (isinstance(dictdata[key], list)):
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