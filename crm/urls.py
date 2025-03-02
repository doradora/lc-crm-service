from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OwnerViewSet, ProjectViewSet, QuotationViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'owners', OwnerViewSet)  # 業主資料的路由
router.register(r'projects', ProjectViewSet)  # 案件資料的路由
router.register(r'quotations', QuotationViewSet)  # 報價單的路由
router.register(r'invoices', InvoiceViewSet)  # 請款單的路由

urlpatterns = [
    path('', include(router.urls)),  # 包含所有路由
]
