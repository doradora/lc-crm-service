from rest_framework import serializers
from .models import Owner, Project, Quotation, Invoice, Category, ProjectChange
from django.contrib.auth.models import User


class CategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ["id", "code", "description", "projects_count"]


class OwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Owner
        fields = [
            "id",
            "company_name",
            "tax_id",
            "phone",
            "fax",
            "email",
            "mobile",
            "address",
            "contact_person",
        ]


class UserMinimalSerializer(serializers.ModelSerializer):
    """用於專案中展示用戶的最小序列化器"""

    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name"]

    def get_name(self, obj):
        if hasattr(obj, "profile"):
            return obj.profile.name or obj.username
        return obj.username


class ProjectChangeSerializer(serializers.ModelSerializer):
    """專案變更記錄序列化器"""

    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectChange
        fields = [
            "id",
            "project",
            "description",
            "date_created",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = ["date_created"]

    def get_created_by_name(self, obj):
        if obj.created_by and hasattr(obj.created_by, "profile"):
            return obj.created_by.profile.name or obj.created_by.username
        return None if not obj.created_by else obj.created_by.username


class ProjectSerializer(serializers.ModelSerializer):
    # 在獲取時增加名稱字段
    owner_name = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.SerializerMethodField(read_only=True)
    manager_name = serializers.SerializerMethodField(read_only=True)
    drawing_name = serializers.SerializerMethodField(read_only=True)
    changes = ProjectChangeSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "owner_name",
            "category",
            "category_name",
            "year",
            "project_number",
            "name",
            "manager",
            "manager_name",
            "drawing",
            "drawing_name",
            "drawing_other",
            "contact_info",
            "changes",  # 變更記錄關聯
            "notes",
            "is_completed",
            "expenditure",
            "is_invoiced",
            "invoice_date",
            "invoice_amount",
            "payment_date",
            "invoice_issue_date",
            "invoice_notes",
            "is_paid",
        ]
        read_only_fields = [
            "project_number"
        ]  # 將 project_number 設為唯讀欄位，API 不需要提供

    def get_owner_name(self, obj):
        return obj.owner.company_name if obj.owner else None

    def get_category_name(self, obj):
        return (
            f"{obj.category.code}: {obj.category.description}" if obj.category else None
        )

    def get_manager_name(self, obj):
        if obj.manager and hasattr(obj.manager, "profile"):
            return obj.manager.profile.name or obj.manager.username
        return None if not obj.manager else obj.manager.username

    def get_drawing_name(self, obj):
        if obj.drawing and hasattr(obj.drawing, "profile"):
            return obj.drawing.profile.name or obj.drawing.username
        return None if not obj.drawing else obj.drawing.username


class QuotationSerializer(serializers.ModelSerializer):
    has_invoice = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "project", "amount", "date_issued", "has_invoice"]

    def get_has_invoice(self, obj):
        return Invoice.objects.filter(quotation=obj).exists()


class InvoiceSerializer(serializers.ModelSerializer):
    quotation_amount = serializers.SerializerMethodField(read_only=True)
    project_id = serializers.SerializerMethodField(read_only=True)
    project_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "quotation",
            "quotation_amount",
            "project_id",
            "project_name",
            "amount",
            "date_issued",
            "paid",
        ]

    def get_quotation_amount(self, obj):
        return obj.quotation.amount if obj.quotation else None

    def get_project_id(self, obj):
        return (
            obj.quotation.project.id
            if obj.quotation and obj.quotation.project
            else None
        )

    def get_project_name(self, obj):
        return (
            obj.quotation.project.name
            if obj.quotation and obj.quotation.project
            else None
        )
