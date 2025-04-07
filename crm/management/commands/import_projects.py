import csv
import os
import re
from datetime import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from crm.models import Owner, Category, Project, ProjectChange, Quotation, Expenditure


class Command(BaseCommand):
    help = "從CSV文件導入專案資料"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            help="CSV檔案路徑，預設為crm/static/crm/ref/projects.csv",
        )

    def handle(self, *args, **kwargs):
        file_path = kwargs.get("file")
        if not file_path:
            file_path = os.path.join("crm", "static", "crm", "ref", "projects.csv")

        self.stdout.write(
            self.style.SUCCESS(f"開始導入專案資料，檔案位置: {file_path}")
        )

        # 建立預設資料
        self.setup_default_data()

        # 開始導入
        self.import_projects(file_path)

    def setup_default_data(self):
        """建立導入所需的預設資料"""
        # 建立預設使用者
        self.setup_default_users()

        # 建立預設類別
        self.setup_default_categories()

        # 建立預設業主
        self.setup_default_owners()

    def setup_default_users(self):
        """建立CSV中出現的所有使用者"""
        users_to_create = [
            "王美淇",
            "陳俊宏",
            "王岳穎",
            "李明書",
            "楊力宇",
            "羅茗葳",
            "吳聲信",
            "陳昱仲",
            "翁佩芬",
            "蔡宗林",
            "黃柚蓁",
            "郭雅綾",
        ]

        for username in users_to_create:
            User.objects.get_or_create(
                username=username, defaults={"first_name": username, "is_active": True}
            )
        self.stdout.write(self.style.SUCCESS("已建立預設使用者"))

    def setup_default_categories(self):
        """建立CSV中出現的所有類別"""
        categories_to_create = ["A建築", "D 其他"]

        for category_str in categories_to_create:
            # 使用正規表達式解析，匹配前面的字母作為code，後面的文字作為description
            match = re.match(r"^([A-Za-z]+)\s*(.*)$", category_str)
            if match:
                code, description = match.groups()
                Category.objects.get_or_create(
                    code=code,
                    defaults={"description": description if description else code},
                )
            else:
                # 如果無法解析，則整個字串當作code
                Category.objects.get_or_create(
                    code=category_str, defaults={"description": category_str}
                )
        self.stdout.write(self.style.SUCCESS("已建立預設類別"))

    def setup_default_owners(self):
        """建立CSV中出現的所有業主"""
        Owner.objects.get_or_create(
            company_name="蘇寶華建築師事務所",
            defaults={
                "tax_id": "12345678",  # 假設稅碼，實際使用時應更新
                "phone": "04-12345678",
                "email": "info@example.com",
                "address": "彰化縣",
                "contact_person": "蘇寶華",
            },
        )
        self.stdout.write(self.style.SUCCESS("已建立預設業主"))

    def parse_date(self, date_str):
        """解析日期字串"""
        if not date_str or date_str == "1999/12/31":
            return None

        try:
            # 嘗試常見日期格式
            for fmt in ["%Y/%m/%d", "%Y-%m-%d", "%Y年%m月%d日"]:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    def parse_boolean(self, bool_str):
        """將是/否轉換為布林值"""
        return bool_str == "是"

    def parse_amount(self, amount_str):
        """解析金額字串"""
        if not amount_str:
            return Decimal("0")

        # 移除非數字字元(保留小數點)
        amount_str = "".join(ch for ch in amount_str if ch.isdigit() or ch == ".")
        try:
            return Decimal(amount_str) if amount_str else Decimal("0")
        except:
            return Decimal("0")

    @transaction.atomic
    def import_projects(self, csv_file_path):
        """從CSV導入專案資料"""
        imported_count = 0
        skipped_count = 0
        error_count = 0

        with open(csv_file_path, "r", encoding="utf-8") as file:
            reader = csv.DictReader(file)

            for row in reader:
                # 跳過無效資料
                if (
                    not row.get("案件類別")
                    or not row.get("年份")
                    or not row.get("案件編號")
                ):
                    skipped_count += 1
                    continue

                try:
                    # 使用正規表達式解析類別
                    category_str = row.get("案件類別", "")
                    match = re.match(r"^([A-Za-z]+)\s*(.*)$", category_str)
                    if match:
                        category_code = match.group(1)
                    else:
                        category_code = category_str

                    category = Category.objects.filter(code=category_code).first()
                    if not category:
                        self.stdout.write(
                            self.style.WARNING(
                                f"找不到類別: {category_code} (來自 {category_str})，跳過"
                            )
                        )
                        skipped_count += 1
                        continue

                    owner = Owner.objects.filter(company_name=row.get("業主")).first()
                    if not owner:
                        self.stdout.write(
                            self.style.WARNING(f'找不到業主: {row.get("業主")}，跳過')
                        )
                        skipped_count += 1
                        continue

                    # 處理使用者關聯
                    manager_name = row.get("案件負責人", "")
                    manager = None
                    if manager_name:
                        # 處理多個負責人的情況 (取第一個)
                        if "\n" in manager_name:
                            manager_name = manager_name.split("\n")[0].strip()
                        manager = User.objects.filter(username=manager_name).first()

                    drawing_name = row.get("繪圖", "")
                    drawing = None
                    drawing_other = None
                    if drawing_name and drawing_name != "無":
                        drawing = User.objects.filter(username=drawing_name).first()
                        if not drawing:
                            drawing_other = drawing_name

                    # 建立或更新Project
                    project_data = {
                        "owner": owner,
                        "name": row.get("案件名稱", ""),
                        "manager": manager,
                        "drawing": drawing,
                        "drawing_other": drawing_other,
                        "contact_info": row.get("聯絡方式", ""),
                        "notes": row.get("備註", ""),
                        "is_completed": self.parse_boolean(row.get("是否完成", "")),
                        "is_invoiced": self.parse_boolean(row.get("是否請款", "")),
                        "invoice_date": self.parse_date(row.get("請款日期", "")),
                        "invoice_amount": self.parse_amount(row.get("請款金額", "")),
                        "payment_date": self.parse_date(row.get("收款日期", "")),
                        "invoice_issue_date": self.parse_date(row.get("發票日期", "")),
                        "invoice_notes": row.get("請款備註", ""),
                        "is_paid": self.parse_boolean(row.get("是否收款", "")),
                    }

                    project, created = Project.objects.update_or_create(
                        year=int(row.get("年份", 0)),
                        category=category,
                        project_number=row.get("案件編號", ""),
                        defaults=project_data,
                    )

                    # 處理變更記錄
                    changes_text = row.get("變更次數及說明", "")
                    if changes_text:
                        ProjectChange.objects.get_or_create(
                            project=project,
                            description=changes_text,
                            defaults={
                                "created_at": datetime.now().date(),
                                "created_by": manager,
                            },
                        )

                    # 處理報價資訊
                    quotation_amount = self.parse_amount(row.get("報價", ""))
                    if quotation_amount > 0:
                        Quotation.objects.get_or_create(
                            project=project,
                            amount=quotation_amount,
                            defaults={"date_issued": datetime.now().date()},
                        )

                    # 處理支出資訊
                    expenditure_desc = row.get("支出", "")
                    if expenditure_desc:
                        Expenditure.objects.get_or_create(
                            project=project,
                            description=expenditure_desc,
                            defaults={
                                "amount": Decimal("0"),
                                "date": datetime.now().date(),
                                "created_by": manager,
                            },
                        )

                    action = "建立" if created else "更新"
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"{action}專案: {project.year}-{category.code}-{project.project_number} {project.name}"
                        )
                    )
                    imported_count += 1

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(
                            f'處理案件: {row.get("年份", "")}-{row.get("案件編號", "")} 時發生錯誤: {str(e)}'
                        )
                    )
                    error_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"資料導入完成! 成功: {imported_count}, 跳過: {skipped_count}, 錯誤: {error_count}"
            )
        )
