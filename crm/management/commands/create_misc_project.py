from django.core.management.base import BaseCommand
from django.db import transaction
from crm.models import Category, Owner, Project


class Command(BaseCommand):
    help = "建立「其他」專案，用於記錄雜費等不屬於特定專案的費用"

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='強制重新建立，即使資料已存在也會刪除並重建',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)

        try:
            with transaction.atomic():
                # 檢查是否已存在
                existing_category = Category.objects.filter(code='OTHER').first()
                existing_owner = Owner.objects.filter(
                    company_name='系統',
                    tax_id='00000000'
                ).first()
                existing_project = None
                
                if existing_category:
                    existing_project = Project.objects.filter(
                        name='其他',
                        category=existing_category,
                        project_number='9999'
                    ).first()

                if existing_project and not force:
                    self.stdout.write(
                        self.style.WARNING(
                            "「其他」專案已存在！如需重新建立，請使用 --force 參數"
                        )
                    )
                    self.stdout.write(f"  - 類別: {existing_category}")
                    self.stdout.write(f"  - 業主: {existing_owner}")
                    self.stdout.write(f"  - 專案: {existing_project}")
                    return

                if force and existing_project:
                    self.stdout.write(
                        self.style.NOTICE("正在刪除既有的「其他」專案資料...")
                    )
                    # 按順序刪除：專案 -> 業主 -> 類別
                    existing_project.delete()
                    self.stdout.write("  - 已刪除「其他」專案")
                    
                    if existing_owner and not existing_owner.project_set.exists():
                        existing_owner.delete()
                        self.stdout.write("  - 已刪除「系統」業主")
                    
                    if existing_category and not existing_category.project_set.exists():
                        existing_category.delete()
                        self.stdout.write("  - 已刪除「其他」類別")

                # 開始建立資料
                self.stdout.write(self.style.NOTICE("開始建立「其他」專案資料..."))

                # 1. 建立「其他」類別
                category, category_created = Category.objects.get_or_create(
                    code='OTHER',
                    defaults={
                        'description': '其他'
                    }
                )
                if category_created:
                    self.stdout.write(self.style.SUCCESS("  ✓ 已建立「其他」類別"))
                else:
                    self.stdout.write("  - 「其他」類別已存在，略過建立")

                # 2. 建立「系統」業主
                owner, owner_created = Owner.objects.get_or_create(
                    tax_id='00000000',
                    defaults={
                        'company_name': '系統',
                        'phone': '000-0000-0000',
                        'address': '系統內建',
                        'contact_person': '系統管理員'
                    }
                )
                if owner_created:
                    self.stdout.write(self.style.SUCCESS("  ✓ 已建立「系統」業主"))
                else:
                    self.stdout.write("  - 「系統」業主已存在，略過建立")

                # 3. 建立「其他」專案
                project, project_created = Project.objects.get_or_create(
                    year=2099,
                    category=category,
                    project_number='9999',
                    defaults={
                        'owner': owner,
                        'name': '其他',
                        'report_name': '雜費項目',
                        'contact_info': '系統內建項目',
                        'notes': '此專案用於記錄發票中的雜費項目，如影印費、郵資費等不屬於特定專案的費用。',
                        'is_completed': False,
                        'total_expenditure': 0,
                        'is_invoiced': False,
                        'is_paid': False,
                        'custom_fields': {}
                    }
                )
                if project_created:
                    self.stdout.write(self.style.SUCCESS("  ✓ 已建立「其他」專案"))
                else:
                    self.stdout.write("  - 「其他」專案已存在，略過建立")

                # 顯示結果
                self.stdout.write("")
                self.stdout.write(self.style.SUCCESS("========== 建立完成 =========="))
                self.stdout.write(f"類別編號: {category.code}")
                self.stdout.write(f"類別說明: {category.description}")
                self.stdout.write(f"業主名稱: {owner.company_name}")
                self.stdout.write(f"業主統編: {owner.tax_id}")
                self.stdout.write(f"專案年份: {project.year}")
                self.stdout.write(f"專案編號: {project.project_number}")
                self.stdout.write(f"專案名稱: {project.name}")
                self.stdout.write("==============================")

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"建立失敗：{str(e)}")
            )
            raise
