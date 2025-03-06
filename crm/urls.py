from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OwnerViewSet, ProjectViewSet, QuotationViewSet, InvoiceViewSet, index

router = DefaultRouter()
router.register(r"owners", OwnerViewSet)  # 業主資料的路由
router.register(r"projects", ProjectViewSet)  # 案件資料的路由
router.register(r"quotations", QuotationViewSet)  # 報價單的路由
router.register(r"invoices", InvoiceViewSet)  # 請款單的路由

urlpatterns = [
    path("", index, name="index"),  # 首頁
    path("projects", index, name="projects"),  # 案件列表
    path("quotations", index, name="quotations"),  # 報價單列表
    path("invoices", index, name="invoices"),  # 請款單列表
    path("api", include(router.urls)),  # 包含所有CRUD路由
]
