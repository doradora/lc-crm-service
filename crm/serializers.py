from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import (
    Owner,
    Project,
    Quotation,
    Payment,
    Invoice,
    Category,
    ProjectChange,
    Expenditure,
    PaymentProject,
)
from django.contrib.auth.models import User


class CategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True, default=0)
    # name = serializers.SerializerMethodField()  # 新增：用於顯示在下拉選單的名稱
    custom_field_schema = serializers.JSONField(required=False)

    class Meta:
        model = Category
        fields = [
            "id",
            "code",
            "description",
            "projects_count",
            # "name",
            "custom_field_schema",
        ]  # 增加 custom_field_schema 欄位

    # def get_name(self, obj):
    #     """返回類別代碼和描述的組合，用於顯示在下拉選單中"""
    #     return f"{obj.code}: {obj.description}" if obj.code else obj.description


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
            "created_at",
            "created_by",
            "created_by_name",
        ]
        read_only_fields = ["created_by"]

    def get_created_by_name(self, obj):
        if obj.created_by and hasattr(obj.created_by, "profile"):
            return obj.created_by.profile.name or obj.created_by.username
        return None if not obj.created_by else obj.created_by.username


class ExpenditureSerializer(serializers.ModelSerializer):
    """專案支出序列化器"""

    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Expenditure
        fields = [
            "id",
            "project",
            "amount",
            "description",
            "date",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by and hasattr(obj.created_by, "profile"):
            return obj.created_by.profile.name or obj.created_by.username
        return None if not obj.created_by else obj.created_by.username


class ProjectSerializer(serializers.ModelSerializer):
    # 在獲取時增加名稱字段
    owner_name = serializers.SerializerMethodField(read_only=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all()
    )  # 這裡改成可寫入
    category_detail = CategorySerializer(source='category', read_only=True)
    managers = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), many=True, required=False
    )
    managers_info = serializers.SerializerMethodField(read_only=True)
    changes = ProjectChangeSerializer(many=True, read_only=True)
    expenditures = ExpenditureSerializer(many=True, read_only=True)
    total_expenditure = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    custom_fields = serializers.JSONField(required=False)

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "owner_name",
            "category",
            "category_detail",
            # "category_name",
            "year",
            "project_number",
            "name",
            "managers",
            "managers_info",
            "drawing",
            "contact_info",
            "changes",
            "expenditures",
            "total_expenditure",
            "notes",
            "is_completed",
            "is_invoiced",
            "invoice_date",
            "invoice_amount",
            "payment_date",
            "invoice_issue_date",
            "invoice_notes",
            "is_paid",
            "custom_fields",
        ]
        read_only_fields = [
            "project_number",
            "total_expenditure",
        ]

    def get_owner_name(self, obj):
        return obj.owner.company_name if obj.owner else None

    def get_category_name(self, obj):
        return (
            f"{obj.category.code}: {obj.category.description}" if obj.category else None
        )

    # 新增 get_managers_info 方法
    def get_managers_info(self, obj):
        """返回專案負責人的詳細資訊"""
        managers_data = []
        for manager in obj.managers.all():
            manager_data = {
                "id": manager.id,
                "username": manager.username,
                "name": (
                        manager.profile.name if hasattr(manager, "profile") else None
                    ),
            }
            managers_data.append(manager_data)
        return managers_data

    def update(self, instance, validated_data):
        # 特別處理 managers 欄位
        managers_data = validated_data.pop("managers", None)

        # 更新其他欄位
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # 如果有提供 managers 欄位，更新多對多關係
        if managers_data is not None:
            instance.managers.set(managers_data)

        instance.save()
        return instance


class QuotationSerializer(serializers.ModelSerializer):
    has_invoice = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "project", "amount", "date_issued", "has_invoice"]

    def get_has_invoice(self, obj):
        return Invoice.objects.filter(quotation=obj).exists()


class PaymentProjectSerializer(serializers.ModelSerializer):
    """請款單專案關聯序列化器"""

    project_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PaymentProject
        fields = [
            "id",
            "payment",
            "project",
            "project_name",
            "quotation",
            "amount",
            "description",
        ]

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None


class PaymentSerializer(serializers.ModelSerializer):
    projects = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    payment_projects = PaymentProjectSerializer(
        source="paymentproject_set", many=True, read_only=True
    )
    invoices = serializers.SerializerMethodField(read_only=True)
    owner_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "payment_number",
            "projects",
            "payment_projects",
            "amount",
            "date_issued",
            "due_date",
            "paid",
            "payment_date",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "invoices",
            "owner",
            "owner_name",
        ]
        read_only_fields = ["amount", "created_at"]

    def get_projects(self, obj):
        return [project.id for project in obj.projects.all()]

    def get_created_by_name(self, obj):
        if obj.created_by and hasattr(obj.created_by, "profile"):
            return obj.created_by.profile.name or obj.created_by.username
        return None if not obj.created_by else obj.created_by.username

    def get_invoices(self, obj):
        from .serializers import InvoiceSerializer

        return InvoiceSerializer(obj.invoices.all(), many=True).data
    
    def get_owner_name(self, obj): # 新增 get_owner_name 方法
        return obj.owner.company_name if obj.owner else None


class InvoiceSerializer(serializers.ModelSerializer):
    """發票序列化器"""

    created_by_name = serializers.SerializerMethodField(read_only=True)
    payment_number = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "payment",
            "payment_number",
            "amount",
            "issue_date",
            "tax_amount",
            "payment_received_date", # 新增
            "account_entry_date",    # 新增
            "payment_method",        # 新增
            "actual_received_amount",# 新增
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by and hasattr(obj.created_by, "profile"):
            return obj.created_by.profile.name or obj.created_by.username
        return None if not obj.created_by else obj.created_by.username

    def get_payment_number(self, obj):
        return obj.payment.payment_number if obj.payment else None
