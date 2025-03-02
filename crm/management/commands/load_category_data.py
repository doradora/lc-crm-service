from django.core.management.base import BaseCommand
from django.core.management import call_command
from crm.models import Category


class Command(BaseCommand):
    help = "載入預設的專案類別資料"

    def handle(self, *args, **options):
        # 檢查資料庫中是否已有類別資料
        existing_count = Category.objects.count()

        if existing_count > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"資料庫中已有 {existing_count} 筆類別資料，確定要繼續載入嗎？(y/n): "
                )
            )
            answer = input().lower()
            if answer != "y":
                self.stdout.write(self.style.SUCCESS("已取消載入"))
                return

        # 載入測試資料
        self.stdout.write(self.style.NOTICE("開始載入類別測試資料..."))
        call_command("loaddata", "category_data.json")

        # 顯示載入後的資料數量
        new_count = Category.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"成功載入類別資料！當前資料庫共有 {new_count} 筆類別資料"
            )
        )
