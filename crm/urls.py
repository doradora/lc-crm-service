from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"categories", views.CategoryViewSet)
router.register(r"owners", views.OwnerViewSet)
router.register(r"projects", views.ProjectViewSet)
router.register(r"quotations", views.QuotationViewSet)
router.register(r"invoices", views.InvoiceViewSet)
router.register(r"expenditures", views.ExpenditureViewSet)

urlpatterns = [
    path("", views.index, name="index"),
    path("category/", views.category, name="category"),
    path("owners/", views.owners, name="owners"),
    path("projects/", views.projects, name="projects"),
    path("quotations/", views.quotations, name="quotations"),
    path("invoices/", views.invoices, name="invoices"),
    path("dashboard/", views.project_dashboard, name="project_dashboard"),
    # 關聯路由
    path("owner/<int:owner_id>/projects/", views.owner_projects, name="owner_projects"),
    path(
        "project/<int:project_id>/quotations/",
        views.project_quotations,
        name="project_quotations",
    ),
    path(
        "project/<int:project_id>/invoices/",
        views.project_invoices,
        name="project_invoices",
    ),
    # 新增專案詳情頁路由
    path(
        "project/<int:project_id>/details/",
        views.project_details,
        name="project_details",
    ),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
