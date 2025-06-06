import os
import traceback
import logging
from io import BytesIO
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, Border, Side
from openpyxl.utils import get_column_letter
from copy import copy
from datetime import datetime
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_payment_excel(payment):
    """
    產生請款單 Excel，回傳 BytesIO 物件
    Args:
        payment: Payment instance
    Returns:
        BytesIO: Excel 檔案內容
    Raises:
        FileNotFoundError: 樣板檔案不存在
        ValueError: payment 關聯資料不完整
        Exception: 其他錯誤
    """
    template_file = os.path.join(settings.BASE_DIR, "crm", "excel", "payment.xlsx")
    if not os.path.exists(template_file):
        logger.error(f"Excel 樣板檔案不存在: {template_file}")
        raise FileNotFoundError(f"Excel 樣板檔案不存在: {template_file}")
    try:
        wb = load_workbook(template_file)
        if "請款單" not in wb.sheetnames:
            logger.error(f"Excel 樣板缺少 '請款單' 工作表: {template_file}")
            raise ValueError(f"Excel 樣板缺少 '請款單' 工作表: {template_file}")
        original_ws = wb["請款單"]

        # 檢查 payment 關聯資料
        if not payment.company:
            logger.error(f"請款單缺少公司資訊 (payment id={payment.id})")
            raise ValueError("請款單缺少公司資訊")
        if not payment.owner:
            logger.error(f"請款單缺少業主資訊 (payment id={payment.id})")
            raise ValueError("請款單缺少業主資訊")

        # 設定收款公司資訊
        company = payment.company
        original_ws["B20"] = f"公司名稱：{company.name}"
        original_ws["B21"] = f"負責人：{company.responsible_person}"
        original_ws["B22"] = f"統一編號：{company.tax_id}"
        original_ws["B23"] = f"地址：{company.address}"
        original_ws["B24"] = f"電話：{company.phone}"
        original_ws["B25"] = f"傳真：{company.fax if company.fax else ''}"
        original_ws["B26"] = f"聯絡人：{company.contact_person}"

        # 設定匯款帳號資訊（如果有的話）
        if payment.selected_bank_account:
            bank_account = payment.selected_bank_account
            original_ws["B30"] = f"戶名：{bank_account.account_name}"
            original_ws["B31"] = f"匯款帳號：{bank_account.bank_code}-{bank_account.account_number}"
            original_ws["B32"] = f"銀行名稱：{bank_account.bank_name}"

        # 獲取請款單關聯的專案明細
        payment_projects = payment.paymentproject_set.select_related("project", "project__category")
        owner = payment.owner.company_name

        # 創建專案明細列表
        project_details = []
        for idx, pp in enumerate(payment_projects, 1):
            if not pp.project:
                logger.warning(f"請款單關聯專案不存在 (payment id={payment.id}, paymentproject id={pp.id})")
                continue
            detail = {
                "項次": idx,
                "工程明細": f"{pp.project.name}{f'\n{pp.description}' if pp.description else ''}",
                "金額": pp.amount,
                "project": pp.project,
            }
            project_details.append(detail)
        if not project_details:
            logger.warning(f"請款單無專案明細 (payment id={payment.id})")
            project_details = [
                {"項次": 1, "工程明細": "無專案明細", "金額": 0, "project": None}
            ]

        total_pages = (len(project_details) + 9) // 10
        all_custom_fields = {"pcode": {"display_name": "案號", "order": 0}}
        for detail in project_details:
            project = detail["project"]
            if project and project.category and project.category.custom_field_schema:
                for field_name, field_props in project.category.custom_field_schema.items():
                    if field_name not in all_custom_fields:
                        all_custom_fields[field_name] = {
                            "display_name": field_props.get("display_name", field_name),
                            "order": field_props.get("order", 0),
                        }
        sorted_custom_fields = sorted(
            all_custom_fields.items(), key=lambda x: x[1]["order"]
        )
        custom_field_columns = {}
        next_col = 4
        for field_name, field_props in sorted_custom_fields:
            custom_field_columns[field_name] = next_col
            next_col += 1
        max_column = 3
        if custom_field_columns:
            max_column = max(max_column, max(custom_field_columns.values()))

        for page in range(total_pages):
            if page == 0:
                ws = original_ws
                for col in range(len(sorted_custom_fields)-1):
                    copy_column_and_insert(ws, source_col=5, target_col=4)
            else:
                ws = wb.copy_worksheet(original_ws)
                ws.title = f"請款單-第{page+1}頁"
                for r in range(7, 17):
                    for c in range(1, max_column + 2):
                        cell = ws.cell(row=r, column=c)
                        cell.value = None
            ws.print_area = "A1:C35"
            ws.page_margins.left = 0.72
            ws.page_margins.right = 0.72
            ws.page_margins.top = 0.36
            ws.page_margins.bottom = 0.36
            ws.page_margins.header = 0.32
            ws.page_margins.footer = 0.32
            ws["B4"] = payment.payment_number
            ws["C5"] = (
                f"日期: {payment.date_issued.strftime('%Y/%m/%d') if payment.date_issued else datetime.now().strftime('%Y%m/%d')}"
            )
            ws["B5"] = owner or "未指定業主"
            ws["C17"] = "=SUM(C7:C16)"
            start_idx = page * 10
            end_idx = min(start_idx + 10, len(project_details))
            page_details = project_details[start_idx:end_idx]
            if sorted_custom_fields:
                header_row = 6
                for field_name, field_props in sorted_custom_fields:
                    col = custom_field_columns[field_name]
                    cell = ws.cell(row=header_row, column=col)
                    cell.value = field_props["display_name"]
                    cell.font = Font(bold=True)
                    cell.alignment = Alignment(horizontal="center", vertical="center")
            _fill_project_details(ws, page_details, 7, custom_field_columns)
            for row_idx in range(6, 7 + len(page_details)):
                auto_adjust_row_height(ws, row_idx)
            for col_idx in range(3, ws.max_column + 1):
                auto_adjust_column_width(ws, col_idx)

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
    except Exception as e:
        logger.error(f"產生請款單 Excel 發生錯誤: {str(e)}\n{traceback.format_exc()}")
        raise


def _fill_project_details(ws, project_details, start_row, custom_field_columns):
    for i, detail in enumerate(project_details):
        row = start_row + i
        item_cell = ws.cell(row=row, column=1)
        item_cell.value = detail["項次"]
        detail_cell = ws.cell(row=row, column=2)
        detail_cell.value = detail["工程明細"]
        detail_cell.alignment = Alignment(wrap_text=True, vertical="top")
        amount_cell = ws.cell(row=row, column=3)
        amount_cell.value = detail["金額"]
        amount_cell.number_format = "#,##0"
        amount_cell = ws.cell(row=row, column=4)
        if detail["project"]:
            amount_cell.value = f"{detail['project'].year-1911}{detail['project'].category.code}{detail['project'].project_number}"
        amount_cell.number_format = "#,##0"
        amount_cell = ws.cell(row=row, column=4+len(custom_field_columns))
        amount_cell.value = detail["金額"]
        amount_cell.number_format = "#,##0"
        project = detail["project"]
        if project and hasattr(project, "custom_fields") and custom_field_columns:
            for field_name, col in custom_field_columns.items():
                if field_name in getattr(project, "custom_fields", {}):
                    cell = ws.cell(row=row, column=col)
                    cell.value = project.custom_fields[field_name]
                    cell.border = Border(
                        top=Side(style="mediumDashDot"),
                        bottom=Side(style="mediumDashDot"),
                    )
                    column_letter = get_column_letter(col)
                    ws.column_dimensions[column_letter].hidden = False
                    if project.category and project.category.custom_field_schema:
                        field_type = project.category.custom_field_schema.get(
                            field_name, {}
                        ).get("type")
                        if field_type == "number":
                            cell.number_format = "#,##0.00"
                        elif field_type == "date":
                            cell.number_format = "yyyy-mm-dd"
                        elif field_type == "boolean":
                            cell.value = "是" if cell.value else "否"

def auto_adjust_column_width(ws, column_index=None):
    for col_idx in range(1, ws.max_column + 1) if column_index is None else [column_index]:
        max_length = 0
        column = get_column_letter(col_idx)
        for row in range(1, ws.max_row + 1):
            cell = ws.cell(row=row, column=col_idx)
            if cell.value:
                try:
                    cell_length = 0
                    for char in str(cell.value):
                        if ord(char) > 127:
                            cell_length += 2.1
                        else:
                            cell_length += 1.4
                    if cell.font and cell.font.bold:
                        cell_length *= 1.1
                    if cell_length > max_length:
                        max_length = cell_length
                except:
                    pass
        adjusted_width = max_length + 4
        ws.column_dimensions[column].width = adjusted_width if adjusted_width > 10 else 10

def auto_adjust_row_height(ws, row_index=None):
    for row_idx in range(1, ws.max_row + 1) if row_index is None else [row_index]:
        max_lines = 1
        for col_idx in range(1, ws.max_column + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            if cell.value:
                line_count = str(cell.value).count('\n') + 1
                if cell.alignment and cell.alignment.wrap_text:
                    col_letter = get_column_letter(col_idx)
                    col_width = ws.column_dimensions[col_letter].width
                    if col_width:
                        chars_per_line = int(col_width / 1.2)
                        if chars_per_line > 0:
                            text_length = len(str(cell.value).replace('\n', ''))
                            estimated_lines = text_length / chars_per_line
                            line_count = max(line_count, int(estimated_lines) + 1)
                if line_count > max_lines:
                    max_lines = line_count
        row_height = max_lines * 20
        ws.row_dimensions[row_idx].height = row_height

def copy_column_and_insert(ws, source_col: int, target_col: int):
    ws.insert_cols(target_col)
    for row in range(1, ws.max_row + 1):
        src_cell = ws.cell(row=row, column=source_col)
        tgt_cell = ws.cell(row=row, column=target_col)
        tgt_cell.value = src_cell.value
        tgt_cell.font = copy(src_cell.font)
        tgt_cell.border = copy(src_cell.border)
        tgt_cell.fill = copy(src_cell.fill)
        tgt_cell.number_format = copy(src_cell.number_format)
        tgt_cell.protection = copy(src_cell.protection)
        tgt_cell.alignment = copy(src_cell.alignment)
