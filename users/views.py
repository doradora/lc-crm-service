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
    permission_classes = [permissions.AllowAny]

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

    def options(self, request, *args, **kwargs):
        """
        自訂處理 OPTIONS 請求，確保返回 CORS 標頭
        """
        response = Response(status=200)
        response["Access-Control-Allow-Origin"] = "http://localhost:5174"
        response["Access-Control-Allow-Methods"] = (
            "DELETE, GET, OPTIONS, PATCH, POST, PUT"
        )
        response["Access-Control-Allow-Headers"] = (
            "accept, accept-encoding, authorization, content-type, dnt, "
            "origin, user-agent, x-csrftoken, x-requested-with"
        )
        return response
