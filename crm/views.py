import os
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, get_object_or_404, redirect
from django.db.models import Count, Sum, F, Q, Min, Max
from django.utils import timezone
from django.contrib import messages
from rest_framework import viewsets, filters, permissions, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import (
    Owner,
    Project,
    Quotation,
    Payment,
    Invoice,
    Category,
    Expenditure,
    ProjectChange,
    PaymentProject,
    Company,  # 添加 Company
    BankAccount,  # 添加 BankAccount
)
from .serializers import (
    OwnerSerializer,
    ProjectSerializer,
    QuotationSerializer,
    PaymentSerializer,
    InvoiceSerializer,
    CategorySerializer,
    ExpenditureSerializer,
    ProjectChangeSerializer,
    PaymentProjectSerializer,
    CompanySerializer,  # 添加 CompanySerializer
    BankAccountSerializer,  # 添加 BankAccountSerializer
)
import pandas as pd
import traceback
from openpyxl import Workbook, load_workbook
from copy import copy
from openpyxl.drawing.image import Image
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.styles import Alignment, Font, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied
from .permissions import IsAdminOrCanRequestPayment, IsAdmin

@login_required(login_url="signin")
def category(request):
    if not request.user.profile.is_admin:
        raise PermissionDenied
    return render(request, "crm/pages/category.html")


@login_required(login_url="signin")
def owners(request):
    return render(request, "crm/pages/owner/owners.html")


@login_required(login_url="signin")
def projects(request):
    return render(request, "crm/pages/projects.html")


@login_required(login_url="signin")
def quotations(request):
    if request.user.profile.is_admin or request.user.profile.can_request_payment:
        return render(request, "crm/pages/quotations.html")
    else:
        raise PermissionDenied
    


@login_required(login_url="signin")
def invoices(request):
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    return render(request, "crm/pages/invoices.html")


@login_required(login_url="signin")
def owner_projects(request, owner_id):
    """顯示特定業主的專案列表"""
    owner = get_object_or_404(Owner, id=owner_id)
    return render(request, "crm/pages/owner/owner_projects.html", {"owner": owner})


@login_required(login_url="signin")
def project_quotations(request, project_id):
    """顯示特定專案的報價列表"""
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    project = get_object_or_404(Project, id=project_id)
    return render(request, "crm/pages/project_quotations.html", {"project": project})


@login_required(login_url="signin")
def project_invoices(request, project_id):
    """顯示特定專案的請款列表"""
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    project = get_object_or_404(Project, id=project_id)
    return render(request, "crm/pages/project_invoices.html", {"project": project})


@login_required(login_url="signin")
def project_payments(request, project_id):
    """顯示特定專案的請款列表"""
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    project = get_object_or_404(Project, id=project_id)
    return render(request, "crm/pages/project_payments.html", {"project": project})


@login_required(login_url="signin")
def project_dashboard(request):
    """顯示專案儀表板頁面"""
    return render(request, "crm/pages/project_dashboard.html")


@login_required(login_url="signin")
def project_details(request, project_id):
    """
    顯示專案詳情頁面
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        messages.error(request, "專案不存在")
        return redirect("projects")

    # 檢查用戶權限
    # 這裡可以添加額外的權限檢查，例如檢查該用戶是否有權限查看特定專案

    context = {
        "project_id": project_id,
        "page_title": f"專案詳情 - {project.name}",
    }

    return render(request, "crm/pages/project_detail.html", context)


# 請款頁面


@login_required(login_url="signin")
def create_payment(request):
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    return render(request, "crm/pages/payments/create_payment.html")


@login_required(login_url="signin")
def payments(request):
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    return render(request, "crm/pages/payments/payments.html")


@login_required(login_url="signin")
def payment_details(request, payment_id):
    """
    顯示付款單詳情頁面
    """
    if not request.user.profile.is_admin and not request.user.profile.can_request_payment:
        raise PermissionDenied
    
    try:
        payment = Payment.objects.get(id=payment_id)
    except Payment.DoesNotExist:
        messages.error(request, "付款單不存在")
        return redirect("payments")

    context = {
        "payment_id": payment_id,
        "page_title": f"請款單詳情 - {payment.payment_number}",
    }

    return render(request, "crm/pages/payments/payment_detail.html", context)


@login_required(login_url="signin")
def companys(request):
    """顯示收款公司列表"""
    if not request.user.profile.is_admin:
        raise PermissionDenied
    return render(request, "crm/pages/company/companys.html")


@login_required(login_url="signin")
def company_details(request, company_id):
    """
    顯示公司詳情頁面
    """
    if not request.user.profile.is_admin:
        raise PermissionDenied
    
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        messages.error(request, "公司不存在")
        return redirect("companys")

    context = {
        "company_id": company_id,
        "page_title": f"公司詳情 - {company.name}",
    }

    return render(request, "crm/pages/company/company_detail.html", context)


# API
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 5
    page_size_query_param = "page_size"
    max_page_size = 100


class BaseViewSet(viewsets.ModelViewSet):
    """
    基礎視圖集，提供通用的認證和權限設置
    所有 API 視圖都需要繼承此類
    """

    authentication_classes = [SessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

class AdminOnlyViewSet(viewsets.ModelViewSet):
    """
    僅限管理員使用的混合類
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    
class CanPaymentViewSet(viewsets.ModelViewSet):
    """
    僅限請款權限的混合類
    """

    permission_classes = [permissions.IsAuthenticated, IsAdminOrCanRequestPayment]

class CategoryViewSet(BaseViewSet):
    queryset = Category.objects.all().order_by("code")
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "description"]

    def get_permissions(self):
        """
        根據操作類型設定不同的權限。
        - 新增、更新、刪除、更新自訂欄位: 需為管理員。
        - 列表、檢視、取得自訂欄位: 需已認證。
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'update_custom_fields']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        elif self.action in ['list', 'retrieve', 'custom_fields']:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        return Category.objects.annotate(projects_count=Count("project"))

    @action(detail=True, methods=["get"])
    def custom_fields(self, request, pk=None):
        """取得類別的自定義欄位結構"""
        category = self.get_object()
        return Response(category.custom_field_schema or {})

    @action(detail=True, methods=["post"])
    def update_custom_fields(self, request, pk=None):
        """更新類別的自定義欄位結構"""
        category = self.get_object()
        custom_fields = request.data

        # 基本驗證
        if not isinstance(custom_fields, dict):
            return Response(
                {"error": "自定義欄位必須是物件格式"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 驗證每個欄位的格式
        for field_name, field_config in custom_fields.items():
            if not isinstance(field_config, dict):
                return Response(
                    {"error": f"欄位 {field_name} 配置必須是物件格式"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            required_keys = ["display_name", "type"]
            for key in required_keys:
                if key not in field_config:
                    return Response(
                        {"error": f"欄位 {field_name} 缺少必要的配置 {key}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            valid_types = ["text", "textarea", "number", "date", "boolean"]
            if field_config["type"] not in valid_types:
                return Response(
                    {"error": f"欄位 {field_name} 的類型不是有效類型: {valid_types}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 更新自定義欄位結構
        category.custom_field_schema = custom_fields
        category.save(update_fields=["custom_field_schema"])

        return Response(category.custom_field_schema)


class OwnerViewSet(BaseViewSet):
    queryset = Owner.objects.all().order_by("tax_id")
    serializer_class = OwnerSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["company_name", "tax_id", "contact_person", "phone", "email"]


class ProjectViewSet(BaseViewSet):
    queryset = Project.objects.select_related("owner", "category").prefetch_related(
        "changes", "expenditures", "managers"
    )
    serializer_class = ProjectSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "name",
        "owner__company_name",
        "managers__username",
        "managers__profile__name",
    ]

    def get_queryset(self):
        queryset = Project.objects.select_related("owner", "category").prefetch_related(
            "changes", "expenditures", "managers"
        )

        # 搜尋
        search_query = self.request.query_params.get("search", None)
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(owner__company_name__icontains=search_query)
                | Q(managers__username__icontains=search_query)
                | Q(managers__profile__name__icontains=search_query)
            ).distinct()

        # 專案負責人過濾
        manager_id = self.request.query_params.get("manager", None)
        if manager_id:
            queryset = queryset.filter(managers__id=manager_id)

        # 業主過濾
        owner_id = self.request.query_params.get("owner", None)
        if owner_id:
            queryset = queryset.filter(owner_id=owner_id)

        # 類別過濾
        category_id = self.request.query_params.get("category", None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        # 完成狀態過濾
        is_completed = self.request.query_params.get("is_completed", None)
        if is_completed is not None:
            is_completed_bool = is_completed.lower() == "true"
            queryset = queryset.filter(is_completed=is_completed_bool)

        # 發票狀態過濾
        is_invoiced = self.request.query_params.get("is_invoiced", None)
        if is_invoiced is not None:
            is_invoiced = is_invoiced.lower() == "true"
            queryset = queryset.filter(is_invoiced=is_invoiced)

        # 付款狀態過濾
        is_paid = self.request.query_params.get("is_paid", None)
        if is_paid is not None:
            is_paid = is_paid.lower() == "true"
            queryset = queryset.filter(is_paid=is_paid)

        # 年份過濾 - 單一年份
        year = self.request.query_params.get("year", None)
        if year:
            queryset = queryset.filter(year=year)

        # 年份區間過濾 - 開始年份
        year_start = self.request.query_params.get("year_start", None)
        if year_start:
            queryset = queryset.filter(year__gte=year_start)

        # 年份區間過濾 - 結束年份
        year_end = self.request.query_params.get("year_end", None)
        if year_end:
            queryset = queryset.filter(year__lte=year_end)

        return queryset.order_by("-year", "-project_number")

    @action(detail=False, methods=["get"])
    def years(self, request):
        """獲取所有可用的專案年份"""
        years = (
            Project.objects.values_list("year", flat=True).distinct().order_by("-year")
        )

        # 獲取最小和最大年份
        min_year = Project.objects.aggregate(Min("year"))["year__min"]
        max_year = Project.objects.aggregate(Max("year"))["year__max"]

        # 如果沒有專案，設定預設值
        if not min_year:
            current_year = timezone.now().year
            min_year = current_year
            max_year = current_year

        return Response(
            {"years": list(years), "min_year": min_year, "max_year": max_year}
        )

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """獲取專案儀表板所需的統計數據"""
        # 獲取基本統計數據
        total_projects = Project.objects.count()
        active_projects = Project.objects.filter(is_completed=False).count()
        completed_projects = Project.objects.filter(is_completed=True).count()

        # 計算百分比
        completion_rate = (
            round((completed_projects / total_projects) * 100)
            if total_projects > 0
            else 0
        )
        active_projects_percent = (
            round((active_projects / total_projects) * 100) if total_projects > 0 else 0
        )
        completed_projects_percent = (
            round((completed_projects / total_projects) * 100)
            if total_projects > 0
            else 0
        )

        # 營收數據
        total_quotations = Quotation.objects.all()
        total_revenue = Quotation.objects.aggregate(total=Sum("amount"))["total"] or 0
        paid_revenue = (
            Invoice.objects.filter(paid=True).aggregate(total=Sum("amount"))["total"]
            or 0
        )
        unpaid_revenue = total_revenue - paid_revenue

        # 類別分布數據
        category_data = []
        categories = Category.objects.all()
        for category in categories:
            category_count = Project.objects.filter(category=category).count()
            if category_count > 0:
                category_data.append(
                    {
                        "name": f"{category.code}: {category.description}",
                        "count": category_count,
                    }
                )

        # 年度趨勢數據
        yearly_data = []
        years = (
            Project.objects.values("year").annotate(count=Count("id")).order_by("year")
        )
        for year_data in years:
            yearly_data.append({"year": year_data["year"], "count": year_data["count"]})

        # 整合數據
        stats = {
            "totalProjects": total_projects,
            "activeProjects": active_projects,
            "completedProjects": completed_projects,
            "completionRate": completion_rate,
            "activeProjectsPercent": active_projects_percent,
            "completedProjectsPercent": completed_projects_percent,
            "totalRevenue": float(total_revenue),
            "paidRevenue": float(paid_revenue),
            "unpaidRevenue": float(unpaid_revenue),
        }

        return Response(
            {
                "stats": stats,
                "categoryData": category_data,
                "yearlyData": yearly_data,
            }
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # 確保返回更新後的完整資料，包括 managers_info
        return Response(self.get_serializer(instance).data)


class QuotationViewSet(BaseViewSet):
    queryset = Quotation.objects.all().select_related("project")
    serializer_class = QuotationSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]

    def get_queryset(self):
        queryset = Quotation.objects.all().select_related("project", "project__owner")

        # 專案過濾
        project_id = self.request.query_params.get("project", None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset.order_by("-date_issued")


class PaymentViewSet(CanPaymentViewSet):
    queryset = Payment.objects.all().prefetch_related(
        "projects", "paymentproject_set", "paymentproject_set__project"
    )
    serializer_class = PaymentSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["payment_number", "projects__name"]

    def get_queryset(self):
        queryset = Payment.objects.all().prefetch_related(
            "projects", "paymentproject_set", "paymentproject_set__project"
        )

        # 報價過濾
        quotation_id = self.request.query_params.get("quotation", None)
        if quotation_id:
            queryset = queryset.filter(paymentproject__quotation_id=quotation_id)

        # 專案過濾
        project_id = self.request.query_params.get("project", None)
        if project_id:
            queryset = queryset.filter(projects__id=project_id)

        # 客戶過濾
        owner_id = self.request.query_params.get("owner", None)
        if owner_id:
            queryset = queryset.filter(projects__owner_id=owner_id)

        return queryset.order_by("-date_issued")

    def create(self, request, *args, **kwargs):
        """
        建立新請款單，同時處理關聯的專案
        """
        # 建立請款單
        payment_serializer = self.get_serializer(data=request.data)
        payment_serializer.is_valid(raise_exception=True)
        payment = payment_serializer.save(created_by=request.user, amount=0)

        # 處理關聯的專案
        payment_projects = request.data.get("payment_projects", [])
        total_amount = 0

        for project_item in payment_projects:
            project_data = {
                "payment": payment.id,
                "project": project_item.get("project"),
                "quotation": project_item.get("quotation", None),
                "amount": project_item.get("amount"),
                "description": project_item.get("description", ""),
            }

            # 建立請款單-專案關聯
            payment_project_serializer = PaymentProjectSerializer(data=project_data)
            if payment_project_serializer.is_valid():
                payment_project_serializer.save()
                total_amount += float(project_item.get("amount", 0))
            else:
                # 如果某個專案資料有誤，回滾整個交易
                payment.delete()
                return Response(
                    payment_project_serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 更新請款單總金額
        payment.amount = total_amount
        payment.save()

        return Response(
            self.get_serializer(payment).data, status=status.HTTP_201_CREATED
        )

    def partial_update(self, request, *args, **kwargs):
        """支援 PATCH 方法來更新付款狀態"""
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PaymentProjectViewSet(CanPaymentViewSet):
    queryset = PaymentProject.objects.all().select_related("project", "payment")
    serializer_class = PaymentProjectSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        queryset = PaymentProject.objects.all().select_related("project", "payment")

        # 請款單過濾
        payment_id = self.request.query_params.get("payment", None)
        if payment_id:
            queryset = queryset.filter(payment_id=payment_id)

        # 專案過濾
        project_id = self.request.query_params.get("project", None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        # 預加載專案變更次數
        queryset = queryset.prefetch_related("project__changes")

        return queryset

    def perform_create(self, serializer):
        """創建時自動更新請款單總金額"""
        payment_project = serializer.save()
        payment_project.payment.update_amount()

    def perform_update(self, serializer):
        """更新時自動更新請款單總金額"""
        payment_project = serializer.save()
        payment_project.payment.update_amount()

    def perform_destroy(self, instance):
        """刪除時自動更新請款單總金額"""
        payment = instance.payment
        instance.delete()
        payment.update_amount()


class InvoiceViewSet(CanPaymentViewSet):
    queryset = Invoice.objects.all().select_related("payment", "created_by")
    serializer_class = InvoiceSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["invoice_number", "payment__payment_number"]

    def get_queryset(self):
        queryset = Invoice.objects.all().select_related("payment", "created_by")

        # 請款單過濾
        payment_id = self.request.query_params.get("payment", None)
        if payment_id:
            queryset = queryset.filter(payment_id=payment_id)
            
        # 付款狀態過濾（已付款/未付款）
        payment_received_date_isnull = self.request.query_params.get("payment_received_date__isnull", None)
        if payment_received_date_isnull is not None:
            is_null = payment_received_date_isnull.lower() == 'true'
            queryset = queryset.filter(payment_received_date__isnull=is_null)
            
        # 付款方式過濾
        payment_method = self.request.query_params.get("payment_method", None)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
            
        # 日期範圍過濾
        issue_date_gte = self.request.query_params.get("issue_date__gte", None)
        if issue_date_gte:
            queryset = queryset.filter(issue_date__gte=issue_date_gte)
            
        issue_date_lte = self.request.query_params.get("issue_date__lte", None)
        if issue_date_lte:
            queryset = queryset.filter(issue_date__lte=issue_date_lte)

        # 排序參數
        ordering = self.request.query_params.get('ordering', '-issue_date')
        return queryset.order_by(ordering)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


# 案件支出
class ExpenditureViewSet(BaseViewSet):
    queryset = Expenditure.objects.all().select_related("project", "created_by")
    serializer_class = ExpenditureSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["description"]

    def get_queryset(self):
        queryset = Expenditure.objects.all().select_related("project", "created_by")

        # 專案過濾
        project_id = self.request.query_params.get("project", None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset.order_by("-date")

    def perform_create(self, serializer):
        # 自動設置建立者為當前用戶
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # 更新時保留原始建立者
        serializer.save()


# 案件變更
class ProjectChangeViewSet(BaseViewSet):
    queryset = ProjectChange.objects.all().select_related("project", "created_by")
    serializer_class = ProjectChangeSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["description"]

    def get_queryset(self):
        queryset = ProjectChange.objects.all().select_related("project", "created_by")

        # 專案過濾
        project_id = self.request.query_params.get("project", None)
        if project_id:
            queryset = queryset.filter(project_id=project_id)

        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        # 自動設置建立者為當前用戶
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        # 更新時保留原始建立者
        serializer.save()


class CompanyViewSet(BaseViewSet):
    queryset = Company.objects.all().order_by("tax_id")
    serializer_class = CompanySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "tax_id", "contact_person", "phone"]

    def get_permissions(self):
        """
        確保只有管理員可以訪問公司資訊
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bank_accounts', 'add_bank_account']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]
        
    def get_queryset(self):
        return Company.objects.all().prefetch_related('bank_accounts', 'payments').order_by("tax_id")
        
    @action(detail=True, methods=['get'])
    def bank_accounts(self, request, pk=None):
        """獲取公司的銀行帳戶"""
        company = self.get_object()
        bank_accounts = company.bank_accounts.all()
        serializer = BankAccountSerializer(bank_accounts, many=True)
        return Response(serializer.data)
        
    @action(detail=True, methods=['post'])
    def add_bank_account(self, request, pk=None):
        """新增銀行帳戶到公司"""
        company = self.get_object()
        
        # 將公司ID添加到請求數據中
        request_data = request.data.copy()
        request_data['company'] = company.id
        
        serializer = BankAccountSerializer(data=request_data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BankAccountViewSet(BaseViewSet):
    queryset = BankAccount.objects.all().select_related('company')
    serializer_class = BankAccountSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_permissions(self):
        """
        確保只有管理員可以訪問銀行帳戶資訊
        """
        if self.action in ['list', 'retrieve', 'create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]
        
    def get_queryset(self):
        queryset = BankAccount.objects.all().select_related('company')
        
        # 根據公司過濾
        company_id = self.request.query_params.get('company', None)
        if company_id:
            queryset = queryset.filter(company_id=company_id)
            
        return queryset


from rest_framework.decorators import api_view, permission_classes

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_bank_accounts_for_company(request, company_id):
    """根據公司ID獲取該公司的所有銀行帳號"""
    try:
        company = get_object_or_404(Company, id=company_id)
        bank_accounts = BankAccount.objects.filter(company=company)
        serializer = BankAccountSerializer(bank_accounts, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response(
            {"error": str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )


@login_required(login_url="signin")
def index(request):
    return render(request, "crm/index.html")


@login_required(login_url="signin")
def export_payment_excel(request, payment_id):
    """匯出請款單為Excel檔案"""
    try:
        template_file = os.path.join(settings.BASE_DIR, "crm", "excel", "payment.xlsx")
        wb = load_workbook(template_file)
        original_ws = wb["請款單"]  # 保存原始模板工作表的引用

        # 獲取請款單資訊
        payment = get_object_or_404(Payment, id=payment_id)
                
        # 設定收款公司資訊
        company = payment.company
        original_ws["B20"] = f"公司名稱：{company.name}"  
        original_ws["B21"] = f"負責人：{company.responsible_person}"
        original_ws["B22"] = f"統一編號：{company.tax_id}"
        original_ws["B23"] = f"地址：{company.address}"
        original_ws["B24"] = f"電話：{company.phone}"
        original_ws["B25"] = f"傳真：{company.fax if company.fax else ''}"
        original_ws["B26"] = f"聯絡人：{company.contact_person}"
        
        # 設定匯款帳號資訊（如果有的話）
        if payment.selected_bank_account:
            bank_account = payment.selected_bank_account
            original_ws["B30"] = f"戶名：{bank_account.account_name}"
            original_ws["B31"] = f"匯款帳號：{bank_account.bank_code}-{bank_account.account_number}"
            original_ws["B32"] = f"銀行名稱：{bank_account.bank_name}"

        # 獲取請款單關聯的專案明細
        payment_projects = PaymentProject.objects.filter(
            payment=payment
        ).select_related("project", "project__category")

        # 獲取業主資訊
        owner = payment.owner.company_name

        # 創建專案明細列表
        project_details = []
        for idx, pp in enumerate(payment_projects, 1):
            # 檢查項目是否存在
            if pp.project:
                detail = {
                    "項次": idx,
                    "工程明細": f"{pp.project.name}{f'\n{pp.description}' if pp.description else ''}",
                    "金額": pp.amount,
                    "project": pp.project,  # 保存專案對象以便後續提取 custom_fields
                }
                project_details.append(detail)

        # 如果沒有專案明細，使用空列表
        if not project_details:
            project_details = [
                {"項次": 1, "工程明細": "無專案明細", "金額": 0, "project": None}
            ]

        # 計算需要的頁數
        total_pages = (len(project_details) + 9) // 10  # 向上取整，每頁最多10個專案

        # 準備自定義欄位標頭和順序
        all_custom_fields = {
            "pcode": {"display_name": "案號", "order": 0}
        }  # 預設類別欄位

        # 掃描所有專案，收集不同的自定義欄位
        for detail in project_details:
            project = detail["project"]
            if project and project.category and project.category.custom_field_schema:
                for (
                    field_name,
                    field_props,
                ) in project.category.custom_field_schema.items():
                    if field_name not in all_custom_fields:
                        all_custom_fields[field_name] = {
                            "display_name": field_props.get("display_name", field_name),
                            "order": field_props.get("order", 0),
                        }

        # 依照 order 排序自定義欄位
        sorted_custom_fields = sorted(
            all_custom_fields.items(), key=lambda x: x[1]["order"]
        )

        # 設定自定義欄位的欄號
        custom_field_columns = {}
        next_col = 4  # 從第4欄開始放置自定義欄位（項次、工程明細、金額後面）

        for field_name, field_props in sorted_custom_fields:
            custom_field_columns[field_name] = next_col
            next_col += 1
            
        # 計算最大列數以設定正確的列印區域
        max_column = 3  # 默認有項次、工程明細、金額三列
        if custom_field_columns:
            max_column = max(max_column, max(custom_field_columns.values()))

        # 處理每一頁的數據
        for page in range(total_pages):
            # 對於第一頁，使用原始工作表；對於後續頁面，複製原始工作表
            if page == 0:
                ws = original_ws
                for col in range(len(sorted_custom_fields)-1):
                    copy_column_and_insert(ws, source_col=5, target_col=4)
            else:
                # 使用 copy_worksheet 一次性複製整個工作表（包含所有格式和樣式）
                ws = wb.copy_worksheet(original_ws)
                ws.title = f"請款單-第{page+1}頁"
                
                # 清除複製工作表的原始數據
                for r in range(7, 17):  # 清除 row 7-16
                    for c in range(1, max_column + 2):
                        cell = ws.cell(row=r, column=c)
                        cell.value = None
                
            # 設置列印區域
            ws.print_area = "A1:C35" 
            ws.page_margins.left = 0.72  # 左邊界 0.5 吋
            ws.page_margins.right = 0.72  # 右邊界 0.5 吋
            ws.page_margins.top = 0.36  # 上邊界 1 吋
            ws.page_margins.bottom = 0.36
            ws.page_margins.header = 0.32  # 頁首 0.3 吋
            ws.page_margins.footer = 0.32  # 頁尾 0.3 吋
            
            # 設置基本資訊
            ws["B4"] = payment.payment_number
            ws["C5"] = (
                f"日期: {payment.date_issued.strftime('%Y/%m/%d') if payment.date_issued else datetime.now().strftime('%Y%m/%d')}"
            )
            ws["B5"] = owner or "未指定業主"
            ws["C17"] = "=SUM(C7:C16)"  # 計算金額總和

            # 獲取此頁的專案明細
            start_idx = page * 10
            end_idx = min(start_idx + 10, len(project_details))
            page_details = project_details[start_idx:end_idx]

            # 加入自定義欄位標頭
            if sorted_custom_fields:
                header_row = 6
                for field_name, field_props in sorted_custom_fields:
                    col = custom_field_columns[field_name]
                    cell = ws.cell(row=header_row, column=col)
                    cell.value = field_props["display_name"]
                    cell.font = Font(bold=True)
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    # cell.border = Border(
                    #     left=Side(style="thin"),
                    #     right=Side(style="thin"),
                    #     top=Side(style="thin"),
                    #     bottom=Side(style="thin"),
                    # )

            # 填入此頁的工程明細數據
            _fill_project_details(ws, page_details, 7, custom_field_columns)
            
            # 自動調整包含專案明細的行高
            for row_idx in range(6, 7 + len(page_details)):
                auto_adjust_row_height(ws, row_idx)
            
            # 自動調整所有列寬
            for col_idx in range(3, ws.max_column + 1):
                auto_adjust_column_width(ws, col_idx)

        # 建立 HTTP 回應
        response = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response["Content-Disposition"] = (
            f'attachment; filename="payment_{payment.payment_number}_{datetime.now().strftime("%Y%m%d")}.xlsx"'
        )

        # 儲存 Excel 到 response
        wb.save(response)
        return response

    except Exception as e:
        # 發生錯誤時返回錯誤信息
        error_details = traceback.format_exc()  # 獲取詳細錯誤訊息
        print(f"匯出Excel失敗: {str(e)}\n{error_details}")
        return HttpResponse(f"匯出Excel失敗: {str(e)}", status=500)


def _fill_project_details(ws, project_details, start_row, custom_field_columns):
    """填入專案明細和自定義欄位資料

    Args:
        ws: Excel工作表
        project_details: 專案明細列表
        start_row: 起始行號
        custom_field_columns: 自定義欄位的列號對應
    """

    for i, detail in enumerate(project_details):
        row = start_row + i

        # 基本資訊
        item_cell = ws.cell(row=row, column=1)
        item_cell.value = detail["項次"]

        # 工程明細單元格
        detail_cell = ws.cell(row=row, column=2)
        detail_cell.value = detail["工程明細"]
        detail_cell.alignment = Alignment(wrap_text=True, vertical="top")

        # 金額單元格
        amount_cell = ws.cell(row=row, column=3)
        amount_cell.value = detail["金額"]
        amount_cell.number_format = "#,##0"

        amount_cell = ws.cell(row=row, column=4)
        amount_cell.value = f"{detail['project'].year-1911}{detail['project'].category.code}{detail['project'].project_number}"
        print(f"專案代碼: {detail['project'].year}")
        amount_cell.number_format = "#,##0"
        
        amount_cell = ws.cell(row=row, column=4+len(custom_field_columns))
        amount_cell.value = detail["金額"]
        amount_cell.number_format = "#,##0"

        # 填入自定義欄位資料
        project = detail["project"]
        if project and project.custom_fields and custom_field_columns:
            # 填入自定義欄位數據並設定格式
            for field_name, col in custom_field_columns.items():
                if field_name in project.custom_fields:
                    cell = ws.cell(row=row, column=col)
                    cell.value = project.custom_fields[field_name]
                    cell.border = Border(
                        top=Side(style="mediumDashDot"),
                        bottom=Side(style="mediumDashDot"),
                    )
                    
                    # 確保欄是可見的
                    column_letter = get_column_letter(col)
                    ws.column_dimensions[column_letter].hidden = False

                    # 根據欄位類型設置格式
                    if project.category and project.category.custom_field_schema:
                        field_type = project.category.custom_field_schema.get(
                            field_name, {}
                        ).get("type")
                        if field_type == "number":
                            cell.number_format = "#,##0.00"
                        elif field_type == "date":
                            cell.number_format = "yyyy-mm-dd"
                        elif field_type == "boolean":
                            cell.value = "是" if cell.value else "否"

def auto_adjust_column_width(ws, column_index=None):
    """根據儲存格內容自動調整列寬
    
    Args:
        ws: 工作表對象
        column_index: 要調整的列索引，如果為None則調整所有列
    """
    for col_idx in range(1, ws.max_column + 1) if column_index is None else [column_index]:
        max_length = 0
        column = get_column_letter(col_idx)
        
        # 尋找該列中最長的內容
        for row in range(1, ws.max_row + 1):
            cell = ws.cell(row=row, column=col_idx)
            if cell.value:
                # 計算儲存格內容的顯示寬度 (漢字佔用更多空間)
                try:
                    cell_length = 0
                    for char in str(cell.value):
                        if ord(char) > 127:  # 漢字或其他全形字符
                            cell_length += 2.1
                        else:
                            cell_length += 1.4
                    
                    # 考慮字體粗體或特殊格式
                    if cell.font and cell.font.bold:
                        cell_length *= 1.1
                        
                    # 更新最大長度
                    if cell_length > max_length:
                        max_length = cell_length
                except:
                    # 處理無法計算長度的情況
                    pass
        
        # 設置列寬 (加一些額外空間)
        adjusted_width = max_length + 4
        ws.column_dimensions[column].width = adjusted_width if adjusted_width > 10 else 10
        
def auto_adjust_row_height(ws, row_index=None):
    """根據儲存格內容自動調整行高
    
    Args:
        ws: 工作表對象
        row_index: 要調整的行索引，如果為None則調整所有行
    """
    for row_idx in range(1, ws.max_row + 1) if row_index is None else [row_index]:
        max_lines = 1
        
        # 尋找該行中包含換行最多的儲存格
        for col_idx in range(1, ws.max_column + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            if cell.value:
                # 計算換行數量
                line_count = str(cell.value).count('\n') + 1
                
                # 檢查是否啟用了自動換行
                if cell.alignment and cell.alignment.wrap_text:
                    # 估算因自動換行產生的行數
                    # 先獲取列寬
                    col_letter = get_column_letter(col_idx)
                    col_width = ws.column_dimensions[col_letter].width
                    
                    if col_width:
                        # 假設每行可容納的字符數
                        chars_per_line = int(col_width / 1.2)  # 1.2 是粗略估算值
                        if chars_per_line > 0:
                            text_length = len(str(cell.value).replace('\n', ''))
                            estimated_lines = text_length / chars_per_line
                            line_count = max(line_count, int(estimated_lines) + 1)
                
                if line_count > max_lines:
                    max_lines = line_count
        
        # 設置行高 (每行約 20 點)
        row_height = max_lines * 20
        ws.row_dimensions[row_idx].height = row_height
        
def copy_column_and_insert(ws, source_col: int, target_col: int):
    """
    將指定欄位（source_col）複製到指定欄位位置（target_col），會自動先插入欄位
    :param ws: openpyxl 的工作表物件
    :param source_col: 要複製的來源欄位編號（從1開始）
    :param target_col: 要插入並貼上的目標欄位編號（從1開始）
    """
    # Step 1: 插入空白欄，位置就是 target_col
    ws.insert_cols(target_col)

    # Step 2: 開始逐列複製資料與格式
    for row in range(1, ws.max_row + 1):
        src_cell = ws.cell(row=row, column=source_col)
        tgt_cell = ws.cell(row=row, column=target_col)

        tgt_cell.value = src_cell.value
        tgt_cell.font = copy(src_cell.font)
        tgt_cell.border = copy(src_cell.border)
        tgt_cell.fill = copy(src_cell.fill)
        tgt_cell.number_format = copy(src_cell.number_format)
        tgt_cell.protection = copy(src_cell.protection)
        tgt_cell.alignment = copy(src_cell.alignment)
        