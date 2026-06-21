"""
Report generator — matches the output format of get-failed-data.py:
- One row per rule violation
- Columns: file, series number, xmlTree, key, value, dtdErrorLog, <rule columns...>
- Summary sheet with pass/fail counts
"""
import io
import re
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# ── Fills ────────────────────────────────────────────────────────────────────
GREEN_FILL  = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
RED_FILL    = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)
THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"),  bottom=Side(style="thin"),
)


def _apply_header(ws, headers):
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.fill      = HEADER_FILL
        cell.font      = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border    = THIN_BORDER
    ws.row_dimensions[ws.max_row].height = 22


def _auto_width(ws):
    for col in ws.columns:
        max_len   = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max_len + 4, 60)


def _series_number(filename):
    """Extract series number from filename pattern -V-<number>.xml"""
    m = re.search(r"-V-(\d+)\.xml$", filename or "")
    return m.group(1) if m else None


def _parse_rule_name(message):
    """
    Extract rule name from messages like '[Rule Name] violation text'
    Returns (rule_name, violation_text)
    """
    m = re.match(r"^\[(.+?)\]\s*(.*)", message or "")
    if m:
        return m.group(1), m.group(2)
    return "Violation", message or ""


def generate_report(results: list) -> bytes:
    wb = openpyxl.Workbook()

    # ── Summary Sheet ─────────────────────────────────────────────────────────
    ws_summary = wb.active
    ws_summary.title = "Summary"
    _apply_header(ws_summary, [
        "File", "Series Number", "Status", "Error Count", "Warning Count", "DTD Errors"
    ])

    for result in results:
        filename    = result.get("filename", "")
        status      = result.get("status", "fail")
        errors      = result.get("errors", [])
        error_count = sum(1 for e in errors if e.get("severity") == "error")
        warn_count  = sum(1 for e in errors if e.get("severity") == "warning")
        dtd_count   = sum(1 for e in errors if e.get("rule") in ("dtd_structure", "dtd_validation"))

        row  = [filename, _series_number(filename), status.upper(), error_count, warn_count, dtd_count]
        fill = GREEN_FILL if status == "pass" else RED_FILL

        ws_summary.append(row)
        row_idx = ws_summary.max_row
        for col_idx in range(1, len(row) + 1):
            cell        = ws_summary.cell(row=row_idx, column=col_idx)
            cell.fill   = fill
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center")

    _auto_width(ws_summary)

    # ── Detail Sheet — matches get-failed-data.py output format ──────────────
    ws_detail = wb.create_sheet(title="Failed Entries")

    # Collect all unique rule names across all results to build dynamic columns
    all_rule_names = []
    seen_rules = set()
    for result in results:
        for error in result.get("errors", []):
            rule_name, _ = _parse_rule_name(error.get("message", ""))
            if rule_name not in seen_rules and rule_name != "dtdErrorLog":
                seen_rules.add(rule_name)
                all_rule_names.append(rule_name)

    # Fixed columns matching get-failed-data.py + dynamic rule columns
    fixed_cols = ["file", "series number", "xmlTree", "key", "value", "dtdErrorLog"]
    all_cols   = fixed_cols + all_rule_names

    _apply_header(ws_detail, all_cols)
    col_index = {name: i + 1 for i, name in enumerate(all_cols)}

    for result in results:
        filename   = result.get("filename", "")
        series_num = _series_number(filename)
        errors     = result.get("errors", [])

        if not errors:
            # Pass row — green, no violations
            ws_detail.append([filename, series_num] + [""] * (len(all_cols) - 2))
            row_idx = ws_detail.max_row
            for col_idx in range(1, len(all_cols) + 1):
                cell        = ws_detail.cell(row=row_idx, column=col_idx)
                cell.fill   = GREEN_FILL
                cell.border = THIN_BORDER
                cell.alignment = Alignment(vertical="center")
            continue

        # Separate DTD errors from field errors
        dtd_errors   = [e for e in errors if e.get("rule") in ("dtd_structure", "dtd_validation", "dtd_missing")]
        field_errors = [e for e in errors if e.get("rule") not in ("dtd_structure", "dtd_validation", "dtd_missing")]

        # Group field errors by xmlTree+key so each field gets one row
        # with all its rule violations as separate columns
        grouped = {}
        for error in field_errors:
            xml_tree  = error.get("field", "")
            # key is the last segment of the field path (the attribute)
            key       = xml_tree.split(" > ")[-1] if " > " in xml_tree else xml_tree
            value_str = ""  # value not stored in error dict — matches original behaviour
            group_key = (xml_tree, key)
            if group_key not in grouped:
                grouped[group_key] = {
                    "file": filename,
                    "series number": series_num,
                    "xmlTree": xml_tree,
                    "key": key,
                    "value": value_str,
                    "dtdErrorLog": None,
                    "severity": error.get("severity", "error"),
                }
            rule_name, violation_text = _parse_rule_name(error.get("message", ""))
            grouped[group_key][rule_name] = violation_text

        # Write one row per grouped field
        for row_data in grouped.values():
            severity = row_data.pop("severity", "error")
            fill     = RED_FILL if severity == "error" else YELLOW_FILL
            ws_detail.append([""] * len(all_cols))
            row_idx = ws_detail.max_row
            for col_name, val in row_data.items():
                if col_name in col_index:
                    cell           = ws_detail.cell(row=row_idx, column=col_index[col_name], value=val)
                    cell.fill      = fill
                    cell.border    = THIN_BORDER
                    cell.alignment = Alignment(vertical="center", wrap_text=True)
            # Fill remaining cells
            for col_idx in range(1, len(all_cols) + 1):
                cell = ws_detail.cell(row=row_idx, column=col_idx)
                if cell.fill.fgColor.rgb == "00000000":
                    cell.fill   = fill
                    cell.border = THIN_BORDER

        # Write one row per DTD error
        for dtd_err in dtd_errors:
            ws_detail.append([""] * len(all_cols))
            row_idx = ws_detail.max_row
            dtd_row = {
                "file": filename,
                "series number": series_num,
                "xmlTree": None,
                "key": None,
                "value": None,
                "dtdErrorLog": dtd_err.get("message", ""),
            }
            for col_name, val in dtd_row.items():
                if col_name in col_index:
                    cell           = ws_detail.cell(row=row_idx, column=col_index[col_name], value=val)
                    cell.fill      = RED_FILL
                    cell.border    = THIN_BORDER
                    cell.alignment = Alignment(vertical="center", wrap_text=True)
            for col_idx in range(1, len(all_cols) + 1):
                cell = ws_detail.cell(row=row_idx, column=col_idx)
                if cell.fill.fgColor.rgb == "00000000":
                    cell.fill   = RED_FILL
                    cell.border = THIN_BORDER

    _auto_width(ws_detail)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
