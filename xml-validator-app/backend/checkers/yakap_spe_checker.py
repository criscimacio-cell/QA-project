"""
Yakap SPE (Second Tranche) XML Checker.
Wraps core_checker.py + check_second_tranche() from the reference scripts.
"""
import os
import sys
import tempfile

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
REF_DIR   = os.path.join(BASE_DIR, "..", "references", "yakap")
DTD_PATH  = os.path.join(REF_DIR, "KonsultaData_v1.14_1.dtd")
LIBS_DIR  = REF_DIR

if REF_DIR not in sys.path:
    sys.path.insert(0, REF_DIR)

import core_checker as cc

# pPatientAge has no byte-length restriction per PhilHealth
cc.RULES["PROFILE"] = [
    cc._r(attr, None if attr == "pPatientAge" else max_b, *rest)
    for (attr, max_b, *rest) in cc.RULES["PROFILE"]
]

_ALLOWED_DOC_TYPES = {"EKAS", "EPRESS", "OTH", ""}


def _issues_to_errors(issues):
    errors = []
    for issue in issues:
        if issue.level == "INFO":
            continue
        errors.append({
            "field":    issue.category,
            "rule":     issue.category,
            "message":  issue.message,
            "line":     issue.line,
            "severity": "error" if issue.level == "ERROR" else "warning",
        })
    return errors


def _check_second_tranche(root, result):
    for elem in root.iter():
        val = (elem.get("pReportStatus") or "").strip()
        if not val:
            continue

        line = getattr(elem, "sourceline", None)
        tag  = elem.tag

        remarks = (elem.get("pDeficiencyRemarks") or "").strip()

        if val == "F" and not remarks:
            result.add("ERROR", "TRANCHE",
                f"<{tag}> @pDeficiencyRemarks is required when @pReportStatus='F'",
                line=line)

        if val != "F" and remarks:
            result.add("WARNING", "TRANCHE",
                f"<{tag}> @pDeficiencyRemarks should be empty when "
                "@pReportStatus is not 'F'",
                line=line)

    for elem in root.iter("DOCUMENT"):
        doc_type = (elem.get("pDocumentType") or "").strip()
        if doc_type not in _ALLOWED_DOC_TYPES:
            line = getattr(elem, "sourceline", None)
            result.add("ERROR", "TRANCHE",
                f"<DOCUMENT> @pDocumentType='{doc_type}' not in allowed values "
                "['EKAS', 'EPRESS', 'OTH']",
                line=line)


def check_yakap_spe(filename: str, content: str) -> dict:
    dtd_path = DTD_PATH if os.path.isfile(DTD_PATH) else None
    libs_dir = LIBS_DIR if os.path.isdir(LIBS_DIR) else None

    result = cc.Result(xml_file=filename, dtd_file=dtd_path, libs_dir=libs_dir)

    if not dtd_path:
        result.add("WARNING", "DTD",
            f"DTD not found at '{DTD_PATH}' — structural validation was SKIPPED")
    if not libs_dir:
        result.add("WARNING", "LIBRARY",
            f"Libraries folder not found at '{LIBS_DIR}' — code-lookup checks were SKIPPED")

    with tempfile.NamedTemporaryFile(suffix=".xml", delete=False,
                                     mode="w", encoding="utf-8") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        root = cc.check_syntax(tmp_path, result)

        if dtd_path and root is not None:
            cc.check_dtd(tmp_path, dtd_path, result)

        if root is not None:
            libs, missing_libs = cc.load_libraries(libs_dir) if libs_dir else ({}, [])
            for fname in missing_libs:
                result.add("WARNING", "LIBRARY",
                    f"Library file '{fname}' not found — attribute checks using it were SKIPPED")
            cc.check_data_dict(root, libs, result)

        if root is not None:
            cc.check_cross_field(root, result)

        if root is not None:
            cc.check_counts(root, result)

        if root is not None:
            cc.check_referential_integrity(root, result)

        if root is not None:
            cc.check_unique_keys(root, result)

        if root is not None:
            cc.check_id_formats(root, result)

        if root is not None:
            cc.check_demographic_rules(root, result)

        if root is not None:
            cc.check_identity_consistency(root, result)

        if root is not None:
            _check_second_tranche(root, result)

    finally:
        os.unlink(tmp_path)

    errors = _issues_to_errors(result.issues)
    status = "pass" if result.passed else "fail"

    return {
        "filename": filename,
        "status": status,
        "errors": errors,
    }
