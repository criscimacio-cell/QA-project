import io
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# Fill colors
GREEN_FILL = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
RED_FILL = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")

HEADER_FONT = Font(bold=True, color="FFFFFF")
BOLD_FONT = Font(bold=True)

THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)

CENTER = Alignment(horizontal="center", vertical="center")
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)


def _apply_header(ws, headers: list[str]):
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = CENTER
        cell.border = THIN_BORDER


def _auto_width(ws, min_width: int = 12, max_width: int = 60):
    for col_cells in ws.columns:
        col_letter = get_column_letter(col_cells[0].column)
        max_len = min_width
        for cell in col_cells:
            if cell.value:
                max_len = max(max_len, min(len(str(cell.value)), max_width))
        ws.column_dimensions[col_letter].width = max_len + 2


def generate_report(results: list[dict]) -> bytes:
    wb = openpyxl.Workbook()

    # ── Summary Sheet ────────────────────────────────────────────────────────
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.row_dimensions[1].height = 22

    summary_headers = ["Filename", "Status", "Error Count", "Warning Count"]
    _apply_header(ws_summary, summary_headers)

    for row_idx, result in enumerate(results, start=2):
        filename = result.get("filename", "")
        status = result.get("status", "")
        errors = result.get("errors", [])

        error_count = sum(1 for e in errors if e.get("severity") == "error")
        warning_count = sum(1 for e in errors if e.get("severity") == "warning")

        row_fill = GREEN_FILL if status == "pass" else RED_FILL

        values = [filename, status.upper(), error_count, warning_count]
        for col_idx, val in enumerate(values, start=1):
            cell = ws_summary.cell(row=row_idx, column=col_idx, value=val)
            cell.fill = row_fill
            cell.border = THIN_BORDER
            cell.alignment = LEFT if col_idx == 1 else CENTER
            if col_idx == 2:
                cell.font = BOLD_FONT

    _auto_width(ws_summary)

    # ── Detail Sheet ─────────────────────────────────────────────────────────
    ws_detail = wb.create_sheet(title="Details")
    ws_detail.row_dimensions[1].height = 22

    detail_headers = ["Filename", "Field", "Rule", "Message", "Line", "Severity"]
    _apply_header(ws_detail, detail_headers)

    detail_row = 2
    for result in results:
        filename = result.get("filename", "")
        errors = result.get("errors", [])

        if not errors:
            # Write a single "no issues" row
            cell = ws_detail.cell(row=detail_row, column=1, value=filename)
            cell.fill = GREEN_FILL
            cell.border = THIN_BORDER
            cell.alignment = LEFT

            msg_cell = ws_detail.cell(row=detail_row, column=4, value="No issues found")
            msg_cell.fill = GREEN_FILL
            msg_cell.border = THIN_BORDER
            msg_cell.alignment = LEFT

            for col_idx in [2, 3, 5, 6]:
                c = ws_detail.cell(row=detail_row, column=col_idx, value="")
                c.fill = GREEN_FILL
                c.border = THIN_BORDER

            detail_row += 1
        else:
            for error in errors:
                severity = error.get("severity", "error")
                row_fill = RED_FILL if severity == "error" else YELLOW_FILL

                values = [
                    filename,
                    error.get("field", ""),
                    error.get("rule", ""),
                    error.get("message", ""),
                    error.get("line", ""),
                    severity,
                ]
                for col_idx, val in enumerate(values, start=1):
                    cell = ws_detail.cell(row=detail_row, column=col_idx, value=val)
                    cell.fill = row_fill
                    cell.border = THIN_BORDER
                    cell.alignment = LEFT if col_idx in (1, 4) else CENTER

                detail_row += 1

    _auto_width(ws_detail)

    # Freeze header rows
    ws_summary.freeze_panes = "A2"
    ws_detail.freeze_panes = "A2"

    # Save to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.read()
