from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OwnerViewSet, ProjectViewSet, QuotationViewSet, InvoiceViewSet

router = DefaultRouter()
router.register(r'owners', OwnerViewSet)
router.register(r'projects', ProjectViewSet)
router.register(r'quotations', QuotationViewSet)
router.register(r'invoices', InvoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
