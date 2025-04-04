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
)
import pandas as pd
import traceback
from openpyxl import Workbook, load_workbook
from copy import copy
from openpyxl.drawing.image import Image
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.styles import Alignment, Font, Border, Side
from datetime import datetime
from django.http import HttpResponse


@login_required(login_url="signin")
def category(request):
    return render(request, "crm/pages/category.html")


@login_required(login_url="signin")
def owners(request):
    return render(request, "crm/pages/owner/owners.html")


@login_required(login_url="signin")
def projects(request):
    return render(request, "crm/pages/projects.html")


@login_required(login_url="signin")
def quotations(request):
    return render(request, "crm/pages/quotations.html")


@login_required(login_url="signin")
def invoices(request):
    return render(request, "crm/pages/invoices.html")


@login_required(login_url="signin")
def owner_projects(request, owner_id):
    """顯示特定業主的專案列表"""
    owner = get_object_or_404(Owner, id=owner_id)
    return render(request, "crm/pages/owner/owner_projects.html", {"owner": owner})


@login_required(login_url="signin")
def project_quotations(request, project_id):
    """顯示特定專案的報價列表"""
    project = get_object_or_404(Project, id=project_id)
    return render(request, "crm/pages/project_quotations.html", {"project": project})


@login_required(login_url="signin")
def project_invoices(request, project_id):
    """顯示特定專案的請款列表"""
    project = get_object_or_404(Project, id=project_id)
    return render(request, "crm/pages/project_invoices.html", {"project": project})


@login_required(login_url="signin")
def project_payments(request, project_id):
    """顯示特定專案的請款列表"""
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
    return render(request, "crm/pages/payments/create_payment.html")


@login_required(login_url="signin")
def payments(request):
    return render(request, "crm/pages/payments/payments.html")


@login_required(login_url="signin")
def payment_details(request, payment_id):
    """
    顯示付款單詳情頁面
    """
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


class CategoryViewSet(BaseViewSet):
    queryset = Category.objects.all().order_by("code")
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "description"]

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
    queryset = Project.objects.all().select_related(
        "owner", "category", "manager", "drawing"
    )
    serializer_class = ProjectSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = [
        "name",
        "owner__company_name",
        "manager__username",
        "manager__profile__name",
    ]

    def get_queryset(self):
        queryset = Project.objects.all().select_related(
            "owner", "category", "manager", "drawing"
        )

        # 搜尋
        search_query = self.request.query_params.get("search", None)
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query)
                | Q(owner__company_name__icontains=search_query)
                | Q(manager__username__icontains=search_query)
                | Q(manager__profile__name__icontains=search_query)
            )

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


class PaymentViewSet(BaseViewSet):
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


class PaymentProjectViewSet(BaseViewSet):
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


class InvoiceViewSet(BaseViewSet):
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

        return queryset.order_by("-issue_date")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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


@login_required(login_url="signin")
def index(request):
    return render(request, "crm/index.html")


@login_required(login_url="signin")
def export_payment_excel(request, payment_id):
    """匯出請款單為Excel檔案"""
    try:
        template_file = os.path.join(settings.BASE_DIR, "crm", "excel", "invoice.xlsx")
        wb = load_workbook(template_file)
        ws = wb["請款單"]

        # 獲取請款單資訊
        payment = get_object_or_404(Payment, id=payment_id)

        # 獲取請款單關聯的專案明細
        payment_projects = PaymentProject.objects.filter(
            payment=payment
        ).select_related("project")

        # 獲取業主資訊
        owner = payment.owner.company_name

        # 創建專案明細列表
        project_details = []
        for idx, pp in enumerate(payment_projects, 1):
            # 檢查項目是否存在
            if pp.project:
                detail = {
                    "項次": idx,
                    "工程明細": f"{pp.project.name}\n{pp.description or ''}",
                    "金額": pp.amount,
                }
                project_details.append(detail)

        # 如果沒有專案明細，使用空列表
        if not project_details:
            project_details = [{"項次": 1, "工程明細": "無專案明細", "金額": 0}]

        # 設置基本資訊
        ws["B4"] = payment.payment_number
        ws["C5"] = (
            f"日期: {payment.date_issued.strftime('%Y/%m/%d') if payment.date_issued else datetime.now().strftime('%Y%m/%d')}"
        )
        ws["B5"] = owner or "未指定業主"

        # 填入工程明細數據
        start_row = 7
        for i, detail in enumerate(project_details):
            row = start_row + i
            ws.cell(row=row, column=1).value = detail["項次"]

            # 工程明細單元格
            detail_cell = ws.cell(row=row, column=2)
            detail_cell.value = detail["工程明細"]
            detail_cell.alignment = Alignment(wrap_text=True, vertical="top")

            # 金額單元格
            amount_cell = ws.cell(row=row, column=3)
            amount_cell.value = detail["金額"]
            amount_cell.number_format = "#,##0"

        # 設置邊框樣式
        thin_border = Border(
            left=Side(style="thin"),
            right=Side(style="thin"),
            top=Side(style="thin"),
            bottom=Side(style="thin"),
        )

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
