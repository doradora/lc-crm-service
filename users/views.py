from django.shortcuts import render, redirect
from django.contrib.auth import login
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .serializers import (
    UserProfileSerializer,
    UserRegistrationSerializer
)
from .models import UserProfile

# API Views
class UserRegistrationView(APIView):
    """處理使用者註冊的 API 視圖"""
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(
                {'message': '註冊成功', 'user_id': user.id},
                status=status.HTTP_201_CREATED
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
