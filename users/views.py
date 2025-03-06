from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib.auth import login
from rest_framework import status, viewsets, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from .serializers import (
    UserProfileSerializer,
    UserRegistrationSerializer,
    UserCreateSerializer,
    UserSerializer,
    UserWithProfileSerializer,
)
from .models import UserProfile
from .permissions import IsAdmin


@login_required(login_url="signin")
def index(request):
    return render(request, "users/index.html")


# API Views
class UserRegistrationView(APIView):
    """處理使用者註冊的 API 視圖"""

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {"message": "註冊成功", "user_id": user.id},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileViewSet(viewsets.ModelViewSet):
    """處理使用者檔案的 ViewSet"""

    queryset = UserProfile.objects.all()
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """根據使用者權限過濾查詢結果"""
        if self.request.user.profile.is_admin:
            return UserProfile.objects.all()
        return UserProfile.objects.filter(user=self.request.user)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related("profile")
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """
        根據操作類型返回不同的序列化器
        """
        if self.action in ["list", "retrieve"]:
            return UserWithProfileSerializer
        return UserCreateSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
