from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from django.contrib.auth import login
from rest_framework import status, viewsets, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.models import User
from crm.views import StandardResultsSetPagination
from .serializers import (
    UserSerializer,
)
from .permissions import IsAdmin
from django.db.models import Q


@login_required(login_url="signin")
def index(request):
    return render(request, "users/index.html")


# API Views
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().select_related("profile")
    serializer_class = UserSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action == "create":
            # 只有 is_admin=True 的使用者可以創建
            return [IsAuthenticated(), IsAdmin()]
        # 其他操作（如 list、retrieve）可根據需求設定
        return [IsAuthenticated()]  # 預設要求登入

    def get_queryset(self):
        queryset = User.objects.all().select_related(
            "profile"
        )  # 優化查詢，關聯 profile
        search_query = self.request.query_params.get(
            "search", None
        )  # 從前端接收 search 參數
        # 搜尋姓名、email 和電話
        if search_query:
            queryset = queryset.filter(
                Q(username__icontains=search_query)
                | Q(email__icontains=search_query)
                | Q(profile__phone__icontains=search_query)
                | Q(profile__name__icontains=search_query)
                | Q(first_name__icontains=search_query)
                | Q(last_name__icontains=search_query)
            )
        # 角色過濾

        if self.request.query_params.get("is_admin", None):
            queryset = queryset.filter(profile__is_admin=True)
        elif self.request.query_params.get("is_designer", None):
            queryset = queryset.filter(profile__is_designer=True)
        elif self.request.query_params.get("is_project_manager", None):
            queryset = queryset.filter(profile__is_project_manager=True)
        elif self.request.query_params.get("can_request_payment", None):
            queryset = queryset.filter(profile__can_request_payment=True)

        return queryset.order_by("username")
