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
    Company,  # 添加 Company
    BankAccount,  # 添加 BankAccount
    PaymentDocument,  # 添加 PaymentDocument
    ProjectInvoice,  # 添加 ProjectInvoice
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
        queryset=Category.objects.all().order_by("code")
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
    related_payments = serializers.SerializerMethodField()
    # 新增完整案件編號的計算屬性
    full_project_number = serializers.SerializerMethodField(read_only=True)
    # 新增案件編號欄位，允許手動輸入
    project_number = serializers.CharField(
        max_length=100, 
        required=False, 
        allow_blank=True,
        help_text="案件編號，可手動輸入或由系統自動生成"
    )

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
            "full_project_number",  # 新增完整案件編號
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
            "report_name",
            "related_payments",
        ]
        read_only_fields = [
            "total_expenditure",
        ]

    def validate(self, data):
        """驗證案件編號的唯一性"""
        project_number = data.get('project_number')
        year = data.get('year')
        category = data.get('category')
        
        # 如果有提供案件編號，檢查是否重複
        if project_number and year and category:
            # 如果是更新現有專案，排除自己
            queryset = Project.objects.filter(
                year=year,
                category=category,
                project_number=project_number
            )
            
            if self.instance:  # 更新模式
                queryset = queryset.exclude(id=self.instance.id)
            
            if queryset.exists():
                existing_project = queryset.first()
                raise serializers.ValidationError({
                    'project_number': f"案件編號 '{project_number}' 在 {year} 年的 "
                                    f"'{category.code if category else '未分類'}' 類別中已存在。"
                                    f"（現有專案：{existing_project.name}）請輸入其他編號。"
                })
        
        return data

    def get_owner_name(self, obj):
        return obj.owner.company_name if obj.owner else None

    def get_full_project_number(self, obj):
        """產生完整案件編號：年份 + 類別代碼 + 專案編號"""
        if obj.year and obj.category and obj.project_number:
            category_code = obj.category.code if obj.category.code else 'N'
            return f"{obj.year}{category_code}{obj.project_number}"
        return None

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

    def get_related_payments(self, obj):
        """Fetch all related payments for the project."""
        result = []
        for payment in Payment.objects.filter(paymentproject__project=obj):
            payment_project = PaymentProject.objects.filter(payment=payment, project=obj).first()
            if payment_project:
                result.append({
                    'id': payment.id,
                    'payment_number': payment.payment_number,
                    'amount': payment_project.amount,
                    'is_paid': payment.paid,
                    'date_issued': payment.date_issued,
                    'due_date': payment.due_date,
                    'payment_date': payment.payment_date,
                })
        return result


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
    project_info = serializers.SerializerMethodField(read_only=True)  # 新增專案完整資訊
    report_name = serializers.SerializerMethodField(read_only=True)  # 新增報告書名稱欄位
    change_count = serializers.SerializerMethodField(read_only=True)  # 新增變更次數欄位

    class Meta:
        model = PaymentProject
        fields = [
            "id",
            "payment",
            "project",
            "project_name",
            "project_info",  # 新增專案完整資訊欄位
            "report_name",  # 新增報告書名稱欄位
            "quotation",
            "amount",
            "description",
            "change_count",  # 新增變更次數欄位
        ]

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None

    def get_project_info(self, obj):
        """獲取專案的完整資訊"""
        if not obj.project:
            return None
        
        project = obj.project
        category_code = 'N'
        if project.category:
            category_code = project.category.code
        
        return {
            'id': project.id,
            'name': project.name,
            'year': project.year,
            'project_number': project.project_number,
            'category_code': category_code,
        }

    def get_report_name(self, obj):
        """獲取專案的報告書名稱"""
        return obj.project.report_name if obj.project else ''

    def get_change_count(self, obj):
        """
        計算專案的變更次數
        """
        return obj.project.changes.count() if obj.project else 0


class PaymentSerializer(serializers.ModelSerializer):
    projects = serializers.SerializerMethodField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)
    payment_projects = PaymentProjectSerializer(
        source="paymentproject_set", many=True, read_only=True
    )
    invoices = serializers.SerializerMethodField(read_only=True)
    owner_name = serializers.SerializerMethodField(read_only=True)
    company_name = serializers.CharField(source='company.name', read_only=True)
    selected_bank_account_details = serializers.SerializerMethodField(read_only=True)

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
            'company',  # 添加 company 欄位
            'company_name',  # 添加用於顯示的公司名稱
            'selected_bank_account',  # 添加銀行帳號欄位
            'selected_bank_account_details',  # 添加銀行帳號詳細資訊
        ]
        read_only_fields = ["amount", "created_at"]
    
    def create(self, validated_data):
        """創建請款單時自動設置公司的第一個銀行帳戶"""
        # 取得收款公司
        company = validated_data.get('company')
        
        # 創建請款單實例
        payment = super().create(validated_data)
        
        # 如果有指定收款公司，自動選擇該公司的第一個銀行帳戶
        if company:
            first_bank_account = company.bank_accounts.first()
            if first_bank_account:
                payment.selected_bank_account = first_bank_account
                payment.save(update_fields=['selected_bank_account'])
        
        return payment

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
    
    
    def get_selected_bank_account_details(self, obj):
        """獲取選定銀行帳號的詳細資訊"""
        if not hasattr(obj, 'selected_bank_account') or not obj.selected_bank_account:
            return None
            
        return {
            'id': obj.selected_bank_account.id,
            'account_name': obj.selected_bank_account.account_name,
            'account_number': obj.selected_bank_account.account_number,
            'bank_name': obj.selected_bank_account.bank_name,
            'bank_code': obj.selected_bank_account.bank_code,
        }


class InvoiceSerializer(serializers.ModelSerializer):
    """發票序列化器"""

    created_by_name = serializers.SerializerMethodField(read_only=True)
    payment_number = serializers.SerializerMethodField(read_only=True)
    project_amounts = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_type",          # 新增發票類型欄位
            "invoice_number",
            "payment",
            "payment_number",
            "amount",
            "issue_date",
            "tax_amount",
            "payment_status",        # 新增付款狀態欄位
            "is_paid",               # 保留舊欄位以保持相容性
            "payment_received_date", # 新增
            "account_entry_date",    # 新增
            "payment_method",        # 新增
            "actual_received_amount",# 新增
            "project_amounts",       # 新增專案金額關聯
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

    def get_project_amounts(self, obj):
        """獲取發票關聯的專案金額列表"""
        project_invoices = obj.projectinvoice_set.all()
        return [
            {
                "project_id": pi.project.id if pi.project else None,
                "project_name": pi.project.name if pi.project else None,
                "category_code": pi.project.category.code if pi.project and pi.project.category else None,
                "year": pi.project.year if pi.project else None,
                "project_number": pi.project.project_number if pi.project else None,
                "amount": pi.amount or 0
            }
            for pi in project_invoices
        ]


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = [
            "id",
            "company",
            "account_number",
            "account_name",
            "bank_name",
            "bank_code",
        ]
        
class CompanySerializer(serializers.ModelSerializer):
    bank_accounts = BankAccountSerializer(many=True, read_only=True)
    first_bank_account = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "tax_id",
            "phone",
            "fax",
            "responsible_person",
            "address",
            "contact_person",
            "bank_accounts",
            "first_bank_account",
        ]
    
    def get_first_bank_account(self, obj):
        """獲取公司的第一個銀行帳戶"""
        first_account = obj.bank_accounts.first()
        if first_account:
            return BankAccountSerializer(first_account).data
        return None


class PaymentDocumentSerializer(serializers.ModelSerializer):
    """內存請款單檔案序列化器"""
    
    uploaded_by_name = serializers.SerializerMethodField(read_only=True)
    file_size_display = serializers.SerializerMethodField(read_only=True)
    display_filename = serializers.SerializerMethodField(read_only=True)
    
    class Meta:
        model = PaymentDocument
        fields = [
            'id',
            'payment',
            'file',
            'original_filename',
            'file_size',
            'file_size_display',
            'display_filename',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
        ]
        read_only_fields = ['file_size', 'uploaded_at']
    
    def get_uploaded_by_name(self, obj):
        """取得上傳者姓名"""
        if obj.uploaded_by and hasattr(obj.uploaded_by, 'profile'):
            return obj.uploaded_by.profile.name or obj.uploaded_by.username
        return obj.uploaded_by.username if obj.uploaded_by else '未知'
    
    def get_file_size_display(self, obj):
        """取得人類可讀的檔案大小"""
        return obj.get_file_size_display()
    
    def get_display_filename(self, obj):
        """取得顯示用的檔案名稱"""
        return obj.get_display_filename()
    
    def validate_file(self, value):
        """驗證檔案大小限制（1MB）"""
        if value.size > 1024 * 1024:  # 1MB
            raise serializers.ValidationError("檔案大小不能超過 1MB")
        return value


class ProjectInvoiceSerializer(serializers.ModelSerializer):
    invoice_number = serializers.SerializerMethodField(read_only=True)
    project_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectInvoice
        fields = [
            "id",
            "invoice",
            "invoice_number",
            "project",
            "project_name",
        ]

    def get_invoice_number(self, obj):
        return obj.invoice.invoice_number if obj.invoice else None

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None
