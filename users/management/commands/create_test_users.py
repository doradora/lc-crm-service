import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import UserProfile


class Command(BaseCommand):
    help = "創建測試使用者"

    def handle(self, *args, **options):
        # 從 JSON 檔案讀取測試使用者資料
        json_path = Path(__file__).resolve().parent.parent.parent / "fixtures" / "test_users_data.json"
        with open(json_path, "r", encoding="utf-8") as f:
            test_users = json.load(f)

        self.stdout.write("開始創建測試使用者...") 
        for user_data in test_users:
            username = user_data.pop("username")
            email = user_data.pop("email")
            password = user_data.pop("password")
            first_name = user_data.pop("first_name")
            last_name = user_data.pop("last_name")

            # 檢查使用者是否存在
            if User.objects.filter(username=username).exists():
                u = User.objects.get(username=username).last_name
                self.stdout.write(f"使用者 {u} 已存在，跳過創建")
                continue

            # 創建使用者
            user = User.objects.create_user(
                username=username, email=email, password=password, first_name=first_name, last_name=last_name)

            # 創建使用者檔案
            UserProfile.objects.create(user=user, **user_data["profile"])

            self.stdout.write(
                f"已創建使用者: {username} ({user_data['profile']['name']})"
            )

        self.stdout.write(self.style.SUCCESS("測試使用者創建完成"))
