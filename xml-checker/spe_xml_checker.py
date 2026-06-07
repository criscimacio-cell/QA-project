"""
SPE XML Checker — PhilHealth KonSulTa Second Tranche validator.

Usage:
    python spe_xml_checker.py <xml_file> [options]

Options:
    --dtd <file>        Path to DTD file (default: KonsultaData_v1.14_1.dtd beside this script)
    --libs <dir>        Path to LIBRARIES folder containing .xlsx files
    --report <file>     Write plain-text report to file
    --strict            Treat warnings as errors (exit 1)
    --no-color          Disable ANSI colour output

Exit codes:  0 = pass   1 = errors found   2 = usage / file not found
"""

from core_checker import *

_ALLOWED_DOC_TYPES = {"EKAS", "EPRESS", "OTH", ""}


def check_second_tranche(root, result):
    """
    Rules that apply specifically to KonSulTa second tranche XML submissions.
    """
    for elem in root.iter():
        val = (elem.get("pReportStatus") or "").strip()
        if not val:
            continue

        line = getattr(elem, "sourceline", None)
        tag  = elem.tag

        # Rule 1: pReportStatus must be 'V' or 'F'
        if val not in ("V", "F"):
            result.add("ERROR", "TRANCHE",
                f"<{tag}> @pReportStatus='{val}' — second tranche submissions "
                f"must use 'V' (Validated) or 'F' (Failed)",
                line=line)

        remarks = (elem.get("pDeficiencyRemarks") or "").strip()

        # Rule 2: pDeficiencyRemarks required when pReportStatus='F'
        if val == "F" and not remarks:
            result.add("ERROR", "TRANCHE",
                f"<{tag}> @pDeficiencyRemarks is required when @pReportStatus='F'",
                line=line)

        # Rule 3: pDeficiencyRemarks should be empty when pReportStatus != 'F'
        if val != "F" and remarks:
            result.add("WARNING", "TRANCHE",
                f"<{tag}> @pDeficiencyRemarks should be empty when "
                f"@pReportStatus is not 'F'",
                line=line)

    # Rule 4: DOCUMENT pDocumentType must be in allowed set
    for elem in root.iter("DOCUMENT"):
        doc_type = (elem.get("pDocumentType") or "").strip()
        if doc_type not in _ALLOWED_DOC_TYPES:
            line = getattr(elem, "sourceline", None)
            result.add("ERROR", "TRANCHE",
                f"<DOCUMENT> @pDocumentType='{doc_type}' not in allowed values "
                f"['EKAS', 'EPRESS', 'OTH']",
                line=line)


def parse_args():
    return make_arg_parser(
        "SPE XML Checker — Validate a PhilHealth KonSulTa Second Tranche XML file."
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

    # 1 – Well-formedness
    root = check_syntax(args.xml_file, result)

    # 2 – DTD
    if dtd_path and root is not None:
        check_dtd(args.xml_file, dtd_path, result)

    # 3 – Data dictionary + library lookups
    if root is not None:
        libs = load_libraries(libs_dir) if libs_dir else {}
        check_data_dict(root, libs, result)

    # 4 – Cross-field rules
    if root is not None:
        check_cross_field(root, result)

    # 5 – Second tranche rules
    if root is not None:
        check_second_tranche(root, result)

    report = build_report(result, strict=args.strict,
                          title="SPE XML CHECKER",
                          mode_label="Second Tranche (pReportStatus=V/F enforced)")

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
