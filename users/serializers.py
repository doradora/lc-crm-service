from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from .models import UserProfile


class UserSerializer(serializers.ModelSerializer):
    """
    基本用戶序列化器
    提供用戶基本資訊的序列化功能
    """

    class Meta:
        model = User
        fields = ("id", "username", "email")


class UserProfileSerializer(serializers.ModelSerializer):
    """
    用戶個人資料序列化器
    處理擴展的用戶資料的序列化
    """

    class Meta:
        model = UserProfile
        fields = (
            "id",
            "name",
            "phone",
            "is_admin",
            "is_designer",
            "is_project_manager",
            "can_request_payment",
            "created_at",
        )


class UserWithProfileSerializer(serializers.ModelSerializer):
    """
    包含 profile 資訊的使用者序列化器
    合併用戶基本資料與個人資料
    """

    # 嵌入 profile 資訊
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "profile")


class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    用戶註冊序列化器
    處理新用戶註冊的資料驗證和創建
    """

    password2 = serializers.CharField(write_only=True)  # 密碼確認欄位

    class Meta:
        model = get_user_model()
        fields = ("username", "email", "password", "password2")
        extra_kwargs = {"password": {"write_only": True}}  # 確保密碼不會在回應中返回

    def validate(self, data):
        """
        驗證密碼匹配
        確保兩次輸入的密碼相同
        """
        if data["password"] != data["password2"]:
            raise serializers.ValidationError("密碼不匹配")
        return data

    def create(self, validated_data):
        """
        建立新用戶
        移除確認密碼並創建用戶及其個人資料
        """
        validated_data.pop("password2")
        user = get_user_model().objects.create_user(**validated_data)
        UserProfile.objects.create(user=user)  # 同時創建用戶個人資料
        return user


class UserCreateSerializer(serializers.ModelSerializer):
    """
    用戶創建序列化器
    用於後台管理員創建新用戶
    允許同時設定基本資料和個人資料
    """

    password = serializers.CharField(write_only=True)  # 密碼欄位
    name = serializers.CharField(source="profile.name")  # 從個人資料獲取姓名
    phone = serializers.CharField(
        source="profile.phone", required=False, allow_null=True  # 電話為選填欄位
    )

    class Meta:
        model = User
        fields = ("username", "password", "email", "name", "phone")

    def create(self, validated_data):
        """
        創建用戶並設置個人資料
        從驗證後的資料中提取個人資料部分
        """
        profile_data = validated_data.pop("profile", {})
        user = User.objects.create_user(**validated_data)  # 創建基本用戶
        user.profile.name = profile_data.get("name", "")  # 設置姓名
        user.profile.phone = profile_data.get("phone", "")  # 設置電話
        user.profile.save()  # 保存個人資料
        return user
