from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"categories", views.CategoryViewSet)
router.register(r"owners", views.OwnerViewSet)
router.register(r"projects", views.ProjectViewSet)
router.register(r"quotations", views.QuotationViewSet)
router.register(r"invoices", views.InvoiceViewSet)

urlpatterns = [
    path("", views.index, name="index"),
    path("category/", views.category, name="category"),
    path("owners/", views.owners, name="owners"),
    path("projects/", views.projects, name="projects"),
    path("quotations/", views.quotations, name="quotations"),
    path("invoices/", views.invoices, name="invoices"),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
