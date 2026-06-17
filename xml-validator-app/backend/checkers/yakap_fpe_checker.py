"""
Yakap FPE (First Tranche) XML Checker.
Wraps core_checker.py + check_first_tranche() from the reference scripts.
"""
import os
import sys
import tempfile

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
REF_DIR   = os.path.join(BASE_DIR, "..", "references", "yakap")
DTD_PATH  = os.path.join(REF_DIR, "KonsultaData_v1.14_1.dtd")
LIBS_DIR  = REF_DIR   # xlsx files live directly in this folder

# Add reference dir to path so core_checker can be imported
if REF_DIR not in sys.path:
    sys.path.insert(0, REF_DIR)

import core_checker as cc


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


def _check_first_tranche(root, result):
    for elem in root.iter():
        val = (elem.get("pReportStatus") or "").strip()
        if val and val != "U":
            line = getattr(elem, "sourceline", None)
            result.add("ERROR", "TRANCHE",
                f"<{elem.tag}> @pReportStatus='{val}' — "
                "first tranche submissions must use 'U' (Unvalidated)",
                line=line)

    for elem in root.iter("DOCUMENT"):
        has_data = any(
            (elem.get(a) or "").strip()
            for a in ("pDocumentType", "pDocumentUrl", "pHciCaseNo")
        )
        if has_data:
            line = getattr(elem, "sourceline", None)
            result.add("WARNING", "TRANCHE",
                "<DOCUMENT> element is not required in the first tranche "
                "and will be ignored by PhilHealth",
                line=line)


def check_yakap_fpe(filename: str, content: str) -> dict:
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
            _check_first_tranche(root, result)

    finally:
        os.unlink(tmp_path)

    errors = _issues_to_errors(result.issues)
    status = "pass" if result.passed else "fail"

    return {
        "filename": filename,
        "status": status,
        "errors": errors,
    }
