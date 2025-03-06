from django.core.management.base import BaseCommand
from django.core.management import call_command
from crm.models import Owner


class Command(BaseCommand):
    """
    使用 fixtures 建立測試業主資料的命令
    透過 Django 的 loaddata 機制載入 JSON 檔案中的資料
    """

    help = "使用 fixtures 建立測試業主資料"

    def handle(self, *args, **options):
        # 檢查是否已有業主資料
        existing_owners = Owner.objects.count()
        if existing_owners > 0:
            self.stdout.write(
                f"資料庫中已有 {existing_owners} 筆業主資料。如需重新載入，請先清空業主資料。"
            )
            return

        # 使用 loaddata 命令載入資料
        self.stdout.write("開始載入測試業主資料...")

        try:
            call_command("loaddata", "test_owners_data", verbosity=1)
            loaded_count = Owner.objects.count()
            self.stdout.write(
                self.style.SUCCESS(f"成功載入 {loaded_count} 筆測試業主資料")
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"載入資料時發生錯誤: {str(e)}"))
