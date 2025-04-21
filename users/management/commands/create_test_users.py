from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import UserProfile


class Command(BaseCommand):
    help = "創建測試使用者"

    def handle(self, *args, **options):
        test_users = [
            {
                "username": "dora",
                "email": "a5893674@example.com",
                "password": "43675461",
                "first_name": "系統",
                "last_name": "管理員",
                "profile": {
                    "name": "系統管理員",
                    "phone": "0921129796",
                    "is_admin": True,
                    "is_designer": False,
                    "is_project_manager": True,
                    "can_request_payment": True,
                },
            },
            {
                "username": "designer1",
                "email": "designer1@example.com",
                "password": "password123",
                "first_name": "金",
                "last_name": "設計",
                "profile": {
                    "name": "金設計",
                    "phone": "0911222333",
                    "is_admin": False,
                    "is_designer": True,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "designer2",
                "email": "designer2@example.com",
                "password": "password123",
                "first_name": "木",
                "last_name": "設計",
                "profile": {
                    "name": "木設計",
                    "phone": "0922333444",
                    "is_admin": False,
                    "is_designer": True,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "pm1",
                "email": "pm1@example.com",
                "password": "password123",
                "first_name": "火",
                "last_name": "經理",
                "profile": {
                    "name": "火經理",
                    "phone": "0933444555",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": True,
                    "can_request_payment": True,
                },
            },
            {
                "username": "pm2",
                "email": "pm2@example.com",
                "password": "password123",
                "first_name": "土",
                "last_name": "經理",
                "profile": {
                    "name": "土經理",
                    "phone": "0944555666",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": True,
                    "can_request_payment": True,
                },
            },
            {
                "username": "finance1",
                "email": "finance1@example.com",
                "password": "password123",
                "first_name": "錢",
                "last_name": "多多",
                "profile": {
                    "name": "錢多多",
                    "phone": "0955666777",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": True,
                },
            },
            {
                "username": "user001",
                "email": "user001@example.com",
                "password": "password123",
                "first_name": "張",
                "last_name": "曉明",
                "profile": {
                    "name": "張曉明",
                    "phone": "0966777888",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "user002",
                "email": "user002@example.com",
                "password": "password123",
                "first_name": "李",
                "last_name": "小華",
                "profile": {
                    "name": "李小華",
                    "phone": "0977888999",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "user003",
                "email": "user003@example.com",
                "password": "password123",
                "first_name": "王",
                "last_name": "大明",
                "profile": {
                    "name": "王大明",
                    "phone": "0988999000",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "user004",
                "email": "user004@example.com",
                "password": "password123",
                "first_name": "陳",
                "last_name": "小芬",
                "profile": {
                    "name": "陳小芬",
                    "phone": "0999000111",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
            {
                "username": "user005",
                "email": "user005@example.com",
                "password": "password123",
                "first_name": "wang",
                "last_name": "aa",
                "profile": {
                    "name": "wangaa",
                    "phone": "0999000111",
                    "is_admin": False,
                    "is_designer": False,
                    "is_project_manager": False,
                    "can_request_payment": False,
                },
            },
        ]

        self.stdout.write("開始創建測試使用者...")
        for user_data in test_users:
            username = user_data.pop("username")
            email = user_data.pop("email")
            password = user_data.pop("password")

            # 檢查使用者是否存在
            if User.objects.filter(username=username).exists():
                u = User.objects.get(username=username).last_name
                self.stdout.write(f"使用者 {u} 已存在，跳過創建")
                continue

            # 創建使用者
            user = User.objects.create_user(
                username=username, email=email, password=password
            )

            # 更新使用者檔案
            profile = UserProfile.objects.get(user=user)
            for key, value in user_data["profile"].items():
                setattr(profile, key, value)
            profile.save()

            self.stdout.write(
                f"已創建使用者: {username} ({user_data['profile']['name']})"
            )

        self.stdout.write(self.style.SUCCESS("測試使用者創建完成"))
