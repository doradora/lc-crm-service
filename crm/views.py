from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.db.models import Count
from rest_framework import viewsets, filters, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.authentication import SessionAuthentication
from .models import Owner, Project, Quotation, Invoice, Category
from .serializers import (
    OwnerSerializer,
    ProjectSerializer,
    QuotationSerializer,
    InvoiceSerializer,
    CategorySerializer,
)


@login_required(login_url="signin")
def category(request):
    return render(request, "crm/pages/category.html")


@login_required(login_url="signin")
def owners(request):
    return render(request, "crm/pages/owners.html")


@login_required(login_url="signin")
def projects(request):
    return render(request, "crm/pages/projects.html")


@login_required(login_url="signin")
def quotations(request):
    return render(request, "crm/pages/quotations.html")


@login_required(login_url="signin")
def invoices(request):
    return render(request, "crm/pages/invoices.html")


# API
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
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
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["code", "description"]

    def get_queryset(self):
        return Category.objects.annotate(projects_count=Count("project"))


class OwnerViewSet(BaseViewSet):
    queryset = Owner.objects.all()
    serializer_class = OwnerSerializer  # 業主資料的序列化器


class ProjectViewSet(BaseViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer  # 案件資料的序列化器


class QuotationViewSet(BaseViewSet):
    queryset = Quotation.objects.all()
    serializer_class = QuotationSerializer  # 報價單的序列化器


class InvoiceViewSet(BaseViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer  # 請款單的序列化器


@login_required(login_url="signin")
def index(request):
    return render(request, "crm/index.html")
