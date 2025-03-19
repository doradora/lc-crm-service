from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"owners", views.OwnerViewSet)
router.register(r"projects", views.ProjectViewSet)
router.register(r"quotations", views.QuotationViewSet)
router.register(r"payments", views.PaymentViewSet)
router.register(r"invoices", views.InvoiceViewSet)
router.register(r"categories", views.CategoryViewSet)
router.register(r"expenditures", views.ExpenditureViewSet)

urlpatterns = [
    path("", views.index, name="index"),
    path("category/", views.category, name="category"),
    path("owners/", views.owners, name="owners"),
    path("projects/", views.projects, name="projects"),
    path("quotations/", views.quotations, name="quotations"),
    path("payments/", views.payments, name="payments"),
    path("invoices/", views.invoices, name="invoices"),
    path("owner/<int:owner_id>/projects/", views.owner_projects, name="owner_projects"),
    path(
        "project/<int:project_id>/quotations/",
        views.project_quotations,
        name="project_quotations",
    ),
    path(
        "project/<int:project_id>/payments/",
        views.project_payments,
        name="project_payments",
    ),
    path("project/dashboard/", views.project_dashboard, name="project_dashboard"),
    path("project/<int:project_id>/", views.project_details, name="project_details"),
    path("api/", include(router.urls)),
]
