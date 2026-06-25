"""
FPE XML Checker — PhilHealth KonSulTa First Tranche validator.

Usage:
    python fpe_xml_checker.py <xml_file> [options]

Options:
    --dtd <file>        Path to DTD file (default: KonsultaData_v1_14_1.dtd beside this script)
    --libs <dir>        Path to LIBRARIES folder containing .xlsx files
    --report <file>     Write plain-text report to file
    --strict            Treat warnings as errors (exit 1)
    --no-color          Disable ANSI colour output

Exit codes:  0 = pass   1 = errors found   2 = usage / file not found
"""

from core_checker import *


def check_first_tranche(root, result):
    """
    Rules that apply specifically to KonSulTa first tranche XML submissions:
      - All pReportStatus fields must be 'U' (Unvalidated) on submission
      - DOCUMENT element is not yet required — warn if present with data
      - If FAMHIST has Diabetes Mellitus (006), FBS or RBS result is required
    """
    # Diabetes Mellitus rule (FPE only):
    # If any FAMHIST has pMdiseaseCode='006', the corresponding
    # DIAGNOSTICEXAMRESULT must contain an FBS or RBS element.
    fh_diabetes = set()
    for fh in root.iter("FAMHIST"):
        if (fh.get("pMdiseaseCode") or "").strip() == "006":
            profile = fh.getparent()
            while profile is not None and profile.tag != "PROFILE":
                profile = profile.getparent()
            if profile is not None:
                case_no = (profile.get("pHciCaseNo") or "").strip()
                if case_no:
                    fh_diabetes.add(case_no)

    for der in root.iter("DIAGNOSTICEXAMRESULT"):
        case_no = (der.get("pHciCaseNo") or "").strip()
        has_fbs = der.find(".//FBS") is not None
        has_rbs = der.find(".//RBS") is not None

        # FAMHIST 006 → FBS/RBS must be present
        if case_no in fh_diabetes and not has_fbs and not has_rbs:
            result.add("ERROR", "CROSS",
                f"<DIAGNOSTICEXAMRESULT> pHciCaseNo='{case_no}': "
                "FBS or RBS result is required because FAMHIST has "
                "Diabetes Mellitus (pMdiseaseCode='006')",
                line=getattr(der, "sourceline", None))

        # FBS/RBS present → FAMHIST must have 006
        if (has_fbs or has_rbs) and case_no not in fh_diabetes:
            result.add("ERROR", "CROSS",
                f"<DIAGNOSTICEXAMRESULT> pHciCaseNo='{case_no}': "
                "FBS/RBS result is present but FAMHIST has no Diabetes Mellitus "
                "(pMdiseaseCode='006') — remove the result or add 006 to FAMHIST",
                line=getattr(der, "sourceline", None))

    # Every pReportStatus in the document must be 'U' for first tranche
    for elem in root.iter():
        val = (elem.get("pReportStatus") or "").strip()
        if val and val != "U":
            line = getattr(elem, "sourceline", None)
            result.add("ERROR", "TRANCHE",
                f"<{elem.tag}> @pReportStatus='{val}' — "
                f"first tranche submissions must use 'U' (Unvalidated)",
                line=line)

    # DOCUMENT is not required in first tranche — warn if populated
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


def parse_args():
    return make_arg_parser(
        "FPE XML Checker — Validate a PhilHealth KonSulTa First Tranche XML file."
    ).parse_args()


def main() -> int:
    import core_checker as _core
    args = parse_args()

    if args.no_color:
        _core.USE_COLOR = False

    if not os.path.isfile(args.xml_file):
        print(f"Error: XML file not found: {args.xml_file}", file=sys.stderr)
        return 2

    dtd_path  = args.dtd  if os.path.isfile(args.dtd)   else None
    libs_dir  = args.libs if os.path.isdir(args.libs)   else None

    if not dtd_path:
        print(f"WARNING: DTD not found at {args.dtd} – DTD check skipped.", file=sys.stderr)
    if not libs_dir:
        print(f"WARNING: LIBRARIES folder not found at {args.libs} – library checks skipped.",
              file=sys.stderr)

    result = Result(xml_file=args.xml_file, dtd_file=dtd_path, libs_dir=libs_dir)

    if not dtd_path:
        result.add("WARNING", "DTD",
            f"DTD not found at '{args.dtd}' -- structural validation "
            "(required attributes, element order/cardinality) was SKIPPED "
            "for this run")
    if not libs_dir:
        result.add("WARNING", "LIBRARY",
            f"LIBRARIES folder not found at '{args.libs}' -- all "
            "code-lookup checks were SKIPPED for this run")

    # 1 – Well-formedness
    root = check_syntax(args.xml_file, result)

    # 2 – DTD
    if dtd_path and root is not None:
        check_dtd(args.xml_file, dtd_path, result)

    # 2a – Required sections
    if root is not None:
        check_required_sections(root, result)

    # 3 – Data dictionary + library lookups
    if root is not None:
        libs, missing_libs = load_libraries(libs_dir) if libs_dir else ({}, [])
        for fname in missing_libs:
            result.add("WARNING", "LIBRARY",
                f"Library file '{fname}' not found or unreadable in "
                f"'{libs_dir}' -- any attribute that references it was "
                "accepted without a code-list check")
        check_data_dict(root, libs, result)

    # 4 – Cross-field rules
    if root is not None:
        check_cross_field(root, result)

    # 5 – Count verification (pEnlistTotalCnt etc.)
    if root is not None:
        check_counts(root, result)

    # 6 – Referential integrity (pHciCaseNo linkage)
    if root is not None:
        check_referential_integrity(root, result)

    # 6a – Primary-key uniqueness (pHciTransNo per element type)
    if root is not None:
        check_unique_keys(root, result)

    # 6b – Structured-ID format (prefix letter + digit composition)
    if root is not None:
        check_id_formats(root, result)

    # 6c – Demographic-conditional plausibility (sex/age vs section applicability)
    if root is not None:
        check_demographic_rules(root, result)

    # 6d – Cross-record identity consistency (PIN/type vs linked ENLISTMENT)
    if root is not None:
        check_identity_consistency(root, result)

    # 7 – First tranche rules
    if root is not None:
        check_first_tranche(root, result)

    report = build_report(result, strict=args.strict,
                          title="FPE XML CHECKER",
                          mode_label="First Tranche (pReportStatus=U enforced)")

    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(strip_ansi(report))
        print(f"Report written to: {args.report}")
    else:
        print(report)

    fail = not result.passed or (args.strict and len(result.warnings) > 0)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
