import io
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# Color fills
GREEN_FILL = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
RED_FILL = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
YELLOW_FILL = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
HEADER_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)

THIN_BORDER = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)


def apply_header(ws, headers):
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN_BORDER


def auto_width(ws):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            except Exception:
                pass
        adjusted = min(max_len + 4, 60)
        ws.column_dimensions[col_letter].width = adjusted


def generate_report(results):
    """
    Generate an Excel report from validation results.
    Returns bytes of the .xlsx file.
    """
    wb = openpyxl.Workbook()

    # ---- Summary Sheet ----
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.row_dimensions[1].height = 22

    apply_header(ws_summary, ["Filename", "Status", "Error Count", "Warning Count"])

    for result in results:
        filename = result.get("filename", "")
        status = result.get("status", "")
        errors = result.get("errors", [])

        error_count = sum(1 for e in errors if e.get("severity") == "error")
        warning_count = sum(1 for e in errors if e.get("severity") == "warning")

        row = [filename, status.upper(), error_count, warning_count]
        ws_summary.append(row)

        row_idx = ws_summary.max_row
        fill = GREEN_FILL if status == "pass" else RED_FILL
        for col_idx in range(1, 5):
            cell = ws_summary.cell(row=row_idx, column=col_idx)
            cell.fill = fill
            cell.border = THIN_BORDER
            cell.alignment = Alignment(vertical="center")

    auto_width(ws_summary)

    # ---- Detail Sheet ----
    ws_detail = wb.create_sheet(title="Details")
    ws_detail.row_dimensions[1].height = 22

    apply_header(ws_detail, ["Filename", "Field", "Rule", "Message", "Line", "Severity"])

    for result in results:
        filename = result.get("filename", "")
        errors = result.get("errors", [])

        if not errors:
            row = [filename, "", "", "No errors found", "", ""]
            ws_detail.append(row)
            row_idx = ws_detail.max_row
            for col_idx in range(1, 7):
                cell = ws_detail.cell(row=row_idx, column=col_idx)
                cell.fill = GREEN_FILL
                cell.border = THIN_BORDER
                cell.alignment = Alignment(vertical="center", wrap_text=True)
        else:
            for error in errors:
                severity = error.get("severity", "error")
                row = [
                    filename,
                    error.get("field", ""),
                    error.get("rule", ""),
                    error.get("message", ""),
                    error.get("line", ""),
                    severity.upper()
                ]
                ws_detail.append(row)
                row_idx = ws_detail.max_row
                fill = RED_FILL if severity == "error" else YELLOW_FILL
                for col_idx in range(1, 7):
                    cell = ws_detail.cell(row=row_idx, column=col_idx)
                    cell.fill = fill
                    cell.border = THIN_BORDER
                    cell.alignment = Alignment(vertical="center", wrap_text=True)

    auto_width(ws_detail)

    # Save to bytes
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output.getvalue()
