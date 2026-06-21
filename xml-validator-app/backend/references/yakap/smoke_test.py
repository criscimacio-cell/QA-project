"""Quick isolated smoke test for the new/fixed checks in core_checker.py."""
import sys
from lxml import etree
import core_checker as core

def run_dd(name, xml, libs):
    root = etree.fromstring(xml)
    result = core.Result(xml_file="test.xml", dtd_file=None, libs_dir=None)
    core.check_data_dict(root, libs, result)
    print(f"\n--- {name} ---")
    for i in result.issues:
        print(f"  {i.level:8} [{i.category:9}] {i.message}")
    return result

def run(name, xml, fn, *args):
    root = etree.fromstring(xml)
    result = core.Result(xml_file="test.xml", dtd_file=None, libs_dir=None)
    fn(root, result, *args) if args else fn(root, result)
    print(f"\n--- {name} ---")
    for i in result.issues:
        print(f"  {i.level:8} [{i.category:9}] {i.message}")
    return result


# 1. Duplicate PK detection (check_unique_keys)
xml1 = b"""
<PCB>
  <ENLISTMENTS>
    <ENLISTMENT pHciCaseNo="T1234567892026060001" pHciTransNo="E12345678920260600001"/>
    <ENLISTMENT pHciCaseNo="T1234567892026060002" pHciTransNo="E12345678920260600001"/>
  </ENLISTMENTS>
</PCB>
"""
run("check_unique_keys (expect 1 ERROR, duplicate E...0001)", xml1, core.check_unique_keys)


# 2. Structured-ID format checks (check_id_formats)
xml2 = b"""
<PCB pHciTransmittalNumber="BADID123">
  <ENLISTMENTS>
    <ENLISTMENT pHciCaseNo="T1234567892026060001" pHciTransNo="E12345678920260600001"/>
    <ENLISTMENT pHciCaseNo="NOTVALIDCASE" pHciTransNo="ALSOBAD"/>
  </ENLISTMENTS>
</PCB>
"""
run("check_id_formats (expect WARNINGs for PCB transmittal no. and 2nd ENLISTMENT)", xml2, core.check_id_formats)


# 3. Demographic conditional rules (check_demographic_rules)
xml3 = b"""
<PCB>
  <ENLISTMENTS>
    <ENLISTMENT pHciCaseNo="T1234567892026060001" pPatientSex="M" pPatientDob="2026-01-01"/>
  </ENLISTMENTS>
  <PROFILING>
    <PROFILE pHciCaseNo="T1234567892026060001" pProfDate="2026-02-01">
      <MENSHIST pIsApplicable="Y"/>
      <PEPERT/>
    </PROFILE>
  </PROFILING>
</PCB>
"""
run("check_demographic_rules (expect: male+MENSHIST applicable, AND 1-month-old with blank pediatric PEPERT)", xml3, core.check_demographic_rules)


# 4. Cross-record identity consistency (check_identity_consistency)
xml4 = b"""
<PCB>
  <ENLISTMENTS>
    <ENLISTMENT pHciCaseNo="T1234567892026060001" pMemPin="123456789012" pPatientType="MM"/>
  </ENLISTMENTS>
  <SOAPS>
    <SOAP pHciCaseNo="T1234567892026060001" pMemPin="999999999999" pPatientType="DD"/>
  </SOAPS>
</PCB>
"""
run("check_identity_consistency (expect 2 ERRORs: mismatched pMemPin and pPatientType)", xml4, core.check_identity_consistency)


# 5. RULES-table enum fixes (check_data_dict) — SPUTUM / FOBT / PPDTest / FECALYSIS / MEDICINE
xml5 = b"""
<PCB>
  <SOMETHING>
    <SPUTUM pDataCollection="S1" pFindings="P"/>
  </SOMETHING>
</PCB>
"""
run_dd("check_data_dict on SPUTUM (expect 2 ERRORs: 'S1' not in {1,2,3,X}, 'P' not in {1,2})", xml5, {})

xml6 = b"""
<PCB>
  <SOMETHING>
    <FOBT pFindings="X"/>
    <PPDTest pFindings="Z"/>
    <FECALYSIS pBlood="Z" pColor="9"/>
    <MEDICINE pCategory="ANYTHING" pOthMedDrugGrouping="WRONG"/>
  </SOMETHING>
</PCB>
"""
run_dd("check_data_dict on FOBT/PPDTest/FECALYSIS/MEDICINE (expect errors on the now-checked fields, NONE on pCategory)", xml6, {})

print("\nAll smoke tests executed without raising an exception.")
