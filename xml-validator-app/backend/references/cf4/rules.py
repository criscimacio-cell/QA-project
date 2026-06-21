from typing import List
from moment import Moment
import re
from sys import getsizeof
import logging

class AppliedRule:
    def __init__(self, rule, violation, violated):
        self.rule = rule
        self.violation = violation
        self.violated = violated
        
def updateRules(rules:List[AppliedRule], data: AppliedRule|List[AppliedRule]):
    try:
        for idx, rule in enumerate(rules):
            if (rule.rule == data.rule):
                rules[idx].violated = False
                rules[idx].violation = ''
    except:
        logging.error('Rule Required Not Found')
    return rules

def ruleLength(data, length):
    violation = ''
    if (len(data) > length if data else False):
        logging.error(f'Length Violation')
        violation = 'Data exceeds PHIC max length size: ' + str(length)
    return AppliedRule('Length', violation, True if violation else False)

def ruleNotInXML():
    violation = ''
    logging.error('Key not in XML')
    violation = 'Key not in XML'
    return AppliedRule('Key Not In XML', violation, True if violation else False)

def ruleRequired(data):
    violation = ''
    if (not data):
        logging.error('Data is Required')
        violation = 'Data is Required'
    return AppliedRule('Required', violation, True if violation else False)

def ruleRequiredIf(key, value):
    return AppliedRule(f'Required If: {key} - {value}', '', False)

def ruleIntegerFormat(data):
    violation = ''
    try:
        isInteger=int(data)
    except:
        logging.error('Data not in Integer Type')
        violation = 'Data not in Integer Type'
    return AppliedRule('Data Integer Type', violation, True if violation else False)

def ruleRequiredFormatValues(data, requiredValues, nullable=False):
    violation = ''
    if (not data in requiredValues and not nullable):
        logging.error(f'Data does not match any of the PHIC required values: {requiredValues}')
        violation = f'Data does not match any of the PHIC required values: {requiredValues}'
    return AppliedRule('Data Values Match', violation, True if violation else False)

def ruleRequiredNotInValue(data, values):
    violation = ''
    if data in values:
        logging.error(f'Data must not be equal to: {values}')
        violation = f'Data must not be equal to: {values}'
    return AppliedRule('Data Value Must Not Match', violation, True if violation else False)

def ruleRequiredValue(data, requiredValue):
    violation = ''
    if data != requiredValue:
        logging.error(f'Data does not match PHIC required value: {requiredValue}')
        violation = f'Data does not match PHIC required value: {requiredValue}'
    return AppliedRule('Data Value Match', violation, True if violation else False)

def ruleNotInPNFMedicine(data):
    violation = ''
    if data:
        logging.error(f'Data does not exists in PHIC Med Library')
        violation = f'Data does not exists in PHIC Med Library'
    return AppliedRule('Data PNF Med', violation, True if violation else False)

def ruleRequiredFormatEmpty(data):
    violation = ''
    if data:
        logging.error('Data must be empty')
        violation = 'Data must be empty'
    return AppliedRule('Data Not Empty', violation, True if violation else False)

def ruleRequiredYesNoFormat(data):
    violation = ''
    findings = [ruleLength(data, 1)]
    if (not data in {'Y', 'N'}):
        logging.error('Data must either be "Y" or "N"')
        violation = 'Data must either be "Y" or "N"'
    findings.append(AppliedRule('Y,N Value', violation, True if violation else False))
    return findings

def ruleRequiredDateTimeFormat(data="", isDate=False, isTime=False, dateFormat="MM-DD-YYYY", nullable=False):
    violation = ''
    findings = []
    if (isTime):
        findings = [ruleLength(data, 11)]
    else:
        findings = [ruleLength(data, 10)]
    if data:
        if (isDate):
            dataSplit = data.split('-')
            try:
                if (dateFormat == "MM-DD-YYYY"):
                    date=Moment([int(dataSplit[2]), int(dataSplit[0]), int(dataSplit[1])])
                elif (dateFormat == "YYYY-MM-DD"):
                    date=Moment([int(dataSplit[0]), int(dataSplit[1]), int(dataSplit[2])])
            except:
                if (not nullable):
                    logging.error(f'Data does not match PHIC required date format: {dateFormat}')
                    violation = f'Data does not match PHIC required date format: {dateFormat}'
        if (isTime):
            try:
                dataSplit = data.split(':')
                hour = int(dataSplit[0])
                min = int(dataSplit[1])
                second = int(dataSplit[2][0:2])
                meridiem = dataSplit[2][2:4]
                if (meridiem == 'PM' and hour < 12):
                    hour += 12
                date=Moment([2022,1,1,hour,min,second])
            except:
                if (not nullable):
                    logging.error(f'Does not match PHIC required time format: {dateFormat}')
                    violation = f'Does not match PHIC required time format: {dateFormat}'
    else:
        logging.error(f'Data must not be empty')
        violation = f'Data must not be empty'
    findings.append(AppliedRule('Data Format Match', violation, True if violation else False))
    return findings

def ruleFloatFormat(data):
    violation = ''
    try:
        isFloat=float(data)
    except:
        logging.error('Data not in Float Type')
        violation = 'Data not in Float Type'
    return AppliedRule('Data Float Type', violation, True if violation else False)

def ruleAlphaOnly(data):
    violation = ''
    invalidChars = re.findall('[^A-Za-zñÑ/(/)/,/./-]', data.replace(' ', ''))
    if (invalidChars):
        logging.error(f'Invalid Characters: {invalidChars}')
        violation = f'Invalid Characters: {invalidChars}'
    return AppliedRule('Alpha Characters Only', violation, True if violation else False)

def ruleAlphaNumericOnly(data):
    violation = ''
    invalidChars = re.findall('[^A-Za-zñÑ0-9]', data.replace(' ', ''))
    if (invalidChars):
        logging.error(f'Invalid Characters: {invalidChars}')
        violation = f'Invalid Characters: {invalidChars}'
    return AppliedRule('AlphaNumeric Characters Only', violation, True if violation else False)

def ruleRequiredFormat(data, regex=""):
    violation = ''
    isMatch = re.match(regex, data)
    if (not isMatch):
        logging.error('Does not match PHIC required format')
        violation = 'Does not match PHIC required format'
    return AppliedRule('Data Format Match', violation, True if violation else False)

def ruleInvalidValue(data, regex=""):
    violation = ''
    invalidValue = re.fullmatch(regex, data)
    if (invalidValue):
        logging.error('Invalid Value found')
        violation = 'Invalid Value found'
    return AppliedRule('Data Invalid Value', violation, True if violation else False)


def ruleByteSize(data, byteSize):
    violation = ''
    # dataByteSize = getsizeof(data.encode('utf-8'))
    dataByteSize = len(data)
    if (dataByteSize > byteSize):
        logging.error(f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize}')
        if(byteSize == 0):
            violation = f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize}. Should be empty'
        else:
            violation = f'Data exceeds PHIC max byte size of {byteSize}: {dataByteSize}'
    return AppliedRule('Data Byte Size', violation, True if violation else False)

