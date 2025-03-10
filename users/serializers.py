from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = [
            "name",
            "phone",
            "is_admin",
            "is_designer",
            "is_project_manager",
            "can_request_payment",
            "created_at",
        ]


class UserSerializer(serializers.ModelSerializer):
    """
    基本用戶序列化器
    提供用戶基本資訊的序列化功能
    """

    profile = UserProfileSerializer()
    password_confirm = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "email",
            "profile",
            "password_confirm",
            "first_name",
            "last_name",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": False, "allow_blank": True},
        }

    def validate(self, data):
        password = data.get("password")
        password_confirm = data.get("password_confirm")

        if password or password_confirm:  # 如果有提供密碼則驗證
            if password != password_confirm:
                raise serializers.ValidationError({"password": "密碼和密碼確認不一致"})
            if not password:
                raise serializers.ValidationError({"password": "密碼不能為空"})
            if not password_confirm:
                raise serializers.ValidationError(
                    {"password_confirm": "確認密碼不能為空"}
                )

        return data

    def create(self, validated_data):
        # 提取 profile 相關資料
        profile_data = validated_data.pop("profile")

        # 創建 User
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
        )
        # 創建或更新 UserProfile
        UserProfile.objects.create(user=user, **profile_data)

        return user

    def update(self, instance, validated_data):
        # 處理 profile 數據
        profile_data = validated_data.pop("profile", None)
        validated_data.pop("password_confirm", None)  # 移除 password_confirm

        # 更新 User 基本字段
        instance.email = validated_data.get("email", instance.email)
        instance.first_name = validated_data.get("first_name", instance.first_name)
        instance.last_name = validated_data.get("last_name", instance.last_name)

        # 如果提供了密碼，則更新密碼
        if "password" in validated_data and validated_data["password"]:
            instance.set_password(validated_data["password"])

        instance.save()

        # 更新 UserProfile
        if profile_data:
            profile = instance.profile
            profile.phone = profile_data.get("phone", profile.phone)
            profile.is_admin = profile_data.get("is_admin", profile.is_admin)
            profile.is_designer = profile_data.get("is_designer", profile.is_designer)
            profile.is_project_manager = profile_data.get(
                "is_project_manager", profile.is_project_manager
            )
            profile.can_request_payment = profile_data.get(
                "can_request_payment", profile.can_request_payment
            )
            profile.name = profile_data.get("name", profile.name)
            profile.save()

        return instance
