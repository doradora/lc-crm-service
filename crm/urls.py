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
router.register(
    r"project-changes", views.ProjectChangeViewSet
)  # 新增 ProjectChange 視圖集
router.register(
    r"payment-projects", views.PaymentProjectViewSet
)  # 新增 PaymentProject 視圖集

urlpatterns = [
    path("", views.index, name="index"),
    path("category/", views.category, name="category"),
    path("owners/", views.owners, name="owners"),
    path("projects/", views.projects, name="projects"),
    path("quotations/", views.quotations, name="quotations"),
    path("create_payment/", views.create_payment, name="create_payment"),
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
    path(
        "project/<int:project_id>/details/",
        views.project_details,
        name="project_details",
    ),
    path("api/", include(router.urls)),
    path(
        "payment/<int:payment_id>/details/",
        views.payment_details,
        name="payment_details",
    ),
    path(
        "payment/<int:payment_id>/export_excel/",
        views.export_payment_excel,
        name="export_payment_excel",
    ),
]
