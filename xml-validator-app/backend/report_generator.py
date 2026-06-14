import io
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter


# ── Colour fills ──────────────────────────────────────────────────────────────
GREEN_FILL  = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
RED_FILL    = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)


def _style_header_row(ws, row: int = 1) -> None:
    for cell in ws[row]:
        cell.fill      = HEADER_FILL
        cell.font      = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")


def _auto_size_columns(ws) -> None:
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(
            (len(str(cell.value)) for cell in col if cell.value is not None),
            default=0,
        )
        ws.column_dimensions[col_letter].width = min(max_len + 4, 60)


def generate_report(results: list) -> bytes:
    """Build an .xlsx workbook from validation results and return raw bytes.

    Sheets
    ------
    Summary : one row per file – Filename, Status, Error Count, Warning Count
              Green fill for pass rows, red fill for fail rows.
    Details : one row per error/warning – Filename, Field, Rule, Message,
              Line, Severity.  Red fill for error rows, yellow for warnings.
    """
    wb = openpyxl.Workbook()

    # ── Summary sheet ─────────────────────────────────────────────────────────
    summary_ws = wb.active
    summary_ws.title = "Summary"

    summary_ws.append(["Filename", "Status", "Error Count", "Warning Count"])
    _style_header_row(summary_ws)

    for result in results:
        filename = result.get("filename", "")
        status   = result.get("status", "")
        errs     = result.get("errors", [])

        error_count   = sum(1 for e in errs if e.get("severity") == "error")
        warning_count = sum(1 for e in errs if e.get("severity") == "warning")

        summary_ws.append([filename, status.upper(), error_count, warning_count])

        row_fill = GREEN_FILL if status == "pass" else RED_FILL
        for col_idx in range(1, 5):
            summary_ws.cell(row=summary_ws.max_row, column=col_idx).fill = row_fill

    _auto_size_columns(summary_ws)

    # ── Details sheet ─────────────────────────────────────────────────────────
    detail_ws = wb.create_sheet(title="Details")

    detail_ws.append(["Filename", "Field", "Rule", "Message", "Line", "Severity"])
    _style_header_row(detail_ws)

    for result in results:
        filename = result.get("filename", "")
        for error in result.get("errors", []):
            severity = error.get("severity", "error")
            detail_ws.append(
                [
                    filename,
                    error.get("field", ""),
                    error.get("rule", ""),
                    error.get("message", ""),
                    error.get("line") or "",
                    severity.upper(),
                ]
            )
            row_fill = RED_FILL if severity == "error" else YELLOW_FILL
            for col_idx in range(1, 7):
                detail_ws.cell(row=detail_ws.max_row, column=col_idx).fill = row_fill

    _auto_size_columns(detail_ws)

    # ── Serialise ─────────────────────────────────────────────────────────────
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
