import io
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment
from openpyxl.utils import get_column_letter


# Color fills
GREEN_FILL = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
RED_FILL = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)


def auto_size_columns(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max_len + 4, 60)


def style_header_row(ws, row=1):
    for cell in ws[row]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")


def generate_report(results: list) -> bytes:
    wb = openpyxl.Workbook()

    # --- Summary Sheet ---
    summary_ws = wb.active
    summary_ws.title = "Summary"
    summary_headers = ["Filename", "Status", "Error Count", "Warning Count"]
    summary_ws.append(summary_headers)
    style_header_row(summary_ws)

    for result in results:
        filename = result.get("filename", "")
        status = result.get("status", "")
        errors = result.get("errors", [])
        error_count = sum(1 for e in errors if e.get("severity", "error") == "error")
        warning_count = sum(1 for e in errors if e.get("severity", "warning") == "warning")

        row = [filename, status.upper(), error_count, warning_count]
        summary_ws.append(row)

        last_row = summary_ws.max_row
        fill = GREEN_FILL if status == "pass" else RED_FILL
        for col in range(1, 5):
            summary_ws.cell(row=last_row, column=col).fill = fill

    auto_size_columns(summary_ws)

    # --- Detail Sheet ---
    detail_ws = wb.create_sheet(title="Details")
    detail_headers = ["Filename", "Field", "Rule", "Message", "Line", "Severity"]
    detail_ws.append(detail_headers)
    style_header_row(detail_ws)

    for result in results:
        filename = result.get("filename", "")
        for error in result.get("errors", []):
            severity = error.get("severity", "error")
            row = [
                filename,
                error.get("field", ""),
                error.get("rule", ""),
                error.get("message", ""),
                error.get("line", 0),
                severity.upper(),
            ]
            detail_ws.append(row)
            last_row = detail_ws.max_row
            fill = RED_FILL if severity == "error" else YELLOW_FILL
            for col in range(1, 7):
                detail_ws.cell(row=last_row, column=col).fill = fill

    auto_size_columns(detail_ws)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
