from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, get_user_model
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
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.http import JsonResponse


@login_required(login_url="signin")
def index(request):
    return render(request, "users/index.html")


@login_required(login_url="signin")
def profile(request):
    return render(request, "users/profile.html")


@login_required(login_url="signin")
def user_projects(request, user_id):
    User = get_user_model()
    user = get_object_or_404(User, id=user_id)
    
    return render(request, "users/my_projects.html", {
        "target_user": user
    })


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


@method_decorator(csrf_exempt, name='dispatch')
class ImpersonateView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        user_id = request.data.get('user_id')
        if not user_id:
            return JsonResponse({'error': '缺少 user_id'}, status=400)
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return JsonResponse({'error': '找不到該用戶'}, status=404)
        # 切換 session
        login(request, target_user)
        return JsonResponse({'message': f'已切換為 {target_user.first_name}{target_user.last_name} 身份'})

    def get(self, request):
        return JsonResponse({'error': '僅支援 POST'}, status=405)
