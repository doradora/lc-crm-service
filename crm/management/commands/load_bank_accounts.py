from django.core.management.base import BaseCommand
from django.core.management import call_command
from crm.models import BankAccount, Company


class Command(BaseCommand):
    help = "載入預設的銀行帳戶資料 (立信工程顧問有限公司)"

    def handle(self, *args, **options):
        # 檢查公司是否存在
        try:
            company = Company.objects.get(id=1)
            self.stdout.write(self.style.SUCCESS(f"準備為公司「{company.name}」載入銀行帳戶資料"))
        except Company.DoesNotExist:
            self.stdout.write(
                self.style.ERROR("立信工程顧問有限公司 (ID: 1) 不存在於資料庫中，請先建立公司資料")
            )
            return

        # 檢查資料庫中是否已有銀行帳戶資料
        existing_accounts = BankAccount.objects.filter(company=company).count()

        if existing_accounts > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"資料庫中已有 {existing_accounts} 筆「{company.name}」的銀行帳戶資料，確定要繼續載入嗎？(y/n): "
                )
            )
            answer = input().lower()
            if answer != "y":
                self.stdout.write(self.style.SUCCESS("已取消載入"))
                return

        # 載入測試資料
        self.stdout.write(self.style.NOTICE("開始載入銀行帳戶測試資料..."))
        call_command("loaddata", "bank_accounts_data.json")

        # 顯示載入後的資料數量
        new_count = BankAccount.objects.filter(company=company).count()
        self.stdout.write(
            self.style.SUCCESS(
                f"成功載入銀行帳戶資料！「{company.name}」現在共有 {new_count} 筆銀行帳戶資料"
            )
        )
