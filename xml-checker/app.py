"""
app.py — Flask web API for the PhilHealth KonSulTa XML Checker.

Security design:
- Binds to 127.0.0.1 only (never 0.0.0.0)
- Files processed in memory; temp file used only for lxml DTD resolution, deleted immediately
- File size limited to 10 MB (MAX_CONTENT_LENGTH + manual check)
- Only .xml extension and XML content-types accepted
- CORS restricted to localhost origins only
- No stack traces or internal paths in error responses
- tranche parameter validated to "first" or "second" only
- Flask request logging does not log file contents
"""

import logging
import os
import sys
import tempfile

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# ── path setup ───────────────────────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)

import core_checker
import fpe_xml_checker
import spe_xml_checker

# ── app setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__, template_folder=os.path.join(_HERE, "templates"))

# 10 MB hard limit — Flask will return 413 automatically for larger uploads
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Restrict CORS to localhost origins only
CORS(app, resources={r"/api/*": {
    "origins": [
        "http://127.0.0.1:5000",
        "http://localhost:5000",
        "http://127.0.0.1",
        "http://localhost",
    ],
}})

# Suppress werkzeug request lines so uploaded file names/sizes never appear in logs
logging.getLogger("werkzeug").setLevel(logging.ERROR)

# ── constants ─────────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB (belt-and-suspenders)
ALLOWED_CONTENT_TYPES = {
    "application/xml",
    "text/xml",
    "application/octet-stream",  # some browsers send this for .xml
}
VALID_TRANCHES = {"first", "second"}


# ── helpers ───────────────────────────────────────────────────────────────────

def _safe_error(message: str, status: int):
    """Return a JSON error response that never leaks paths or tracebacks."""
    return jsonify({"error": message}), status


def _issues_to_dicts(issues):
    return [
        {
            "level":    i.level,
            "category": i.category,
            "message":  i.message,
            "line":     i.line,
        }
        for i in issues
    ]


def run_check(xml_bytes: bytes, tranche: str) -> core_checker.Result:
    """
    Run all validation checks against xml_bytes for the given tranche.

    lxml requires a file path for DTD resolution, so we write a single
    temp file, validate, then delete it immediately inside a finally block.
    The temp file is created with mkstemp (secure, no predictable name).
    """
    dtd_path = os.path.join(_HERE, "KonsultaData_v1.14_1.dtd")
    libs_dir  = os.path.join(_HERE, "LIBRARIES")

    dtd_path = dtd_path if os.path.isfile(dtd_path) else None
    libs_dir  = libs_dir  if os.path.isdir(libs_dir)  else None

    result = core_checker.Result(
        xml_file="<upload>",
        dtd_file=dtd_path,
        libs_dir=libs_dir,
    )

    tmp_fd   = None
    tmp_path = None
    try:
        # mkstemp returns (fd, path); mode 0o600 by default — only owner can read
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xml")
        try:
            os.write(tmp_fd, xml_bytes)
        finally:
            os.close(tmp_fd)
            tmp_fd = None  # mark as closed so finally block skips double-close

        # 1 – Well-formedness
        root = core_checker.check_syntax(tmp_path, result)

        # 2 – DTD
        if dtd_path and root is not None:
            core_checker.check_dtd(tmp_path, dtd_path, result)

        # 3 – Data dictionary + library lookups
        if root is not None:
            libs = core_checker.load_libraries(libs_dir) if libs_dir else {}
            core_checker.check_data_dict(root, libs, result)

        # 4 – Cross-field rules
        if root is not None:
            core_checker.check_cross_field(root, result)

        # 5 – Count verification
        if root is not None:
            core_checker.check_counts(root, result)

        # 6 – Referential integrity
        if root is not None:
            core_checker.check_referential_integrity(root, result)

        # 7 – Tranche-specific rules
        if root is not None:
            if tranche == "first":
                fpe_xml_checker.check_first_tranche(root, result)
            else:
                spe_xml_checker.check_second_tranche(root, result)

    finally:
        # Always delete the temp file — no exceptions allowed to suppress this
        if tmp_fd is not None:
            try:
                os.close(tmp_fd)
            except OSError:
                pass
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    return result


def _build_plain_report(result: core_checker.Result, tranche: str) -> str:
    """Build a plain-text (ANSI-stripped) report from the result."""
    title      = "FPE XML CHECKER" if tranche == "first" else "SPE XML CHECKER"
    mode_label = (
        "First Tranche (pReportStatus=U enforced)"
        if tranche == "first"
        else "Second Tranche (pReportStatus=V/F enforced)"
    )
    raw = core_checker.build_report(result, strict=False,
                                    title=title, mode_label=mode_label)
    return core_checker.strip_ansi(raw)


# ── routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(os.path.join(_HERE, "templates"), "index.html")


@app.route("/api/check", methods=["POST"])
def api_check():
    # ── tranche validation ────────────────────────────────────────────
    tranche_raw = request.form.get("tranche", "")
    tranche = tranche_raw.strip().lower()
    if tranche not in VALID_TRANCHES:
        return _safe_error(
            'Invalid tranche. Must be "first" or "second".', 400
        )

    # ── file presence ─────────────────────────────────────────────────
    if "file" not in request.files:
        return _safe_error("No file part in the request.", 400)

    upload = request.files["file"]

    if not upload or not upload.filename:
        return _safe_error("No file selected.", 400)

    # ── extension check ───────────────────────────────────────────────
    filename = upload.filename
    if not filename.lower().endswith(".xml"):
        return _safe_error("Only .xml files are accepted.", 415)

    # ── content-type check ────────────────────────────────────────────
    ct = (upload.content_type or "").split(";")[0].strip().lower()
    if ct and ct not in ALLOWED_CONTENT_TYPES:
        return _safe_error(
            "Invalid content type. Only XML files are accepted.", 415
        )

    # ── read into memory (the only disk write happens inside run_check) ──
    xml_bytes = upload.read()

    # ── size check (belt-and-suspenders after MAX_CONTENT_LENGTH) ────
    if len(xml_bytes) > MAX_UPLOAD_BYTES:
        return _safe_error("File exceeds the 10 MB size limit.", 413)

    if len(xml_bytes) == 0:
        return _safe_error("Uploaded file is empty.", 400)

    # ── run validation ────────────────────────────────────────────────
    try:
        result = run_check(xml_bytes, tranche)
    except Exception:
        # Log the full traceback server-side but never expose it to the caller
        app.logger.exception("Unexpected error during XML validation")
        return _safe_error("An internal error occurred during validation.", 500)

    # ── build response ────────────────────────────────────────────────
    errors   = _issues_to_dicts(result.errors)
    warnings = _issues_to_dicts(result.warnings)
    infos    = _issues_to_dicts(
        [i for i in result.issues if i.level == "INFO"]
    )
    all_issues = _issues_to_dicts(result.issues)
    plain_report = _build_plain_report(result, tranche)

    return jsonify({
        "passed":   result.passed,
        "errors":   errors,
        "warnings": warnings,
        "infos":    infos,
        "issues":   all_issues,
        "report":   plain_report,
    })


@app.errorhandler(413)
def request_entity_too_large(_err):
    return _safe_error("File exceeds the 10 MB size limit.", 413)


@app.errorhandler(400)
def bad_request(_err):
    return _safe_error("Bad request.", 400)


# ── entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
