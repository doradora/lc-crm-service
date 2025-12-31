"""
自訂認證後端 - 支援中文姓名登入
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User


class ChineseNameAuthBackend(ModelBackend):
    """
    允許使用者使用中文姓名(first_name + last_name)或 username 登入
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None or password is None:
            return None

        try:
            # 先嘗試用 username 查找
            user = User.objects.filter(username=username).first()
            
            # 如果找不到,嘗試用中文姓名(first_name + last_name)查找
            if not user and len(username) >= 2:
                first_name = username[0]
                last_name = username[1:]
                user = User.objects.filter(
                    first_name=first_name, 
                    last_name=last_name
                ).first()
            
            # 驗證密碼
            if user and user.check_password(password):
                return user
                
        except Exception:
            return None

        return None
