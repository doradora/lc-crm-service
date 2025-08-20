import os
from django.contrib.auth.models import User  # 改用 Django 內建的 User 模型
from django.db import models
from django.utils import timezone


class Owner(models.Model):
    company_name = models.CharField(max_length=255)  # 公司名稱
    tax_id = models.CharField(max_length=10, unique=True)  # 統一編號，確保不重複
    phone = models.CharField(max_length=100)  # 電話
    fax = models.CharField(max_length=100, blank=True, null=True)  # 傳真
    email = models.EmailField()  # Email
    mobile = models.CharField(max_length=100, blank=True, null=True)  # 手機
    address = models.TextField()  # 地址
    contact_person = models.CharField(max_length=255)  # 聯絡人

    def __str__(self):
        return self.company_name  # 修正為使用 company_name 屬性


class Category(models.Model):
    code = models.CharField(max_length=50, unique=True)  # 編號
    description = models.TextField()  # 說明
    custom_field_schema = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.code

    def add_custom_field(self, name, display_name, field_type, required=False, order=0):
        """添加自定義欄位定義"""
        if not self.custom_field_schema:
            self.custom_field_schema = {}

        self.custom_field_schema[name] = {
            "display_name": display_name,
            "type": field_type,  # 'text', 'textarea', 'number', 'date', 'boolean'
            "required": required,
            "order": order,
        }
        self.save()

    def remove_custom_field(self, name):
        """移除自定義欄位定義"""
        if self.custom_field_schema and name in self.custom_field_schema:
            del self.custom_field_schema[name]
            self.save()

    def get_custom_fields(self):
        """取得所有自定義欄位定義"""
        return self.custom_field_schema or {}


class Project(models.Model):
    owner = models.ForeignKey(Owner, on_delete=models.PROTECT)  # 所屬業主
    year = models.IntegerField()  # 年份
    project_number = models.CharField(
        max_length=100, blank=True, null=True
    )  # 案件編號，隨年度自動遞增，設置為可空白和可為null
    name = models.CharField(max_length=255)  # 案件名稱
    report_name = models.CharField(max_length=255, null=True)  # 報告名稱，設為非必填
    # manager = models.ForeignKey(
    #     User, on_delete=models.SET_NULL, null=True, blank=True
    # )  # 案件負責人，設為非必填
    # 新增多對多關係
    managers = models.ManyToManyField(
        User, related_name="managed_projects", blank=True, verbose_name="專案負責人"
    )
    drawing = models.CharField(
        max_length=255, blank=True, null=True
    )  # 繪圖，設為非必填
    contact_info = models.TextField(blank=True)  # 聯絡方式，設為非必填
    notes = models.TextField(blank=True)  # 備註，設為非必填
    is_completed = models.BooleanField(default=False)  # 是否完成
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True
    )  # 案件類別
    total_expenditure = models.DecimalField(
        max_digits=10, decimal_places=0, default=0
    )  # 總支出，設定預設值
    is_invoiced = models.BooleanField(default=False)  # 是否請款
    invoice_date = models.DateField(null=True, blank=True)  # 請款日期
    invoice_amount = models.DecimalField(
        max_digits=10, decimal_places=0, null=True, blank=True
    )  # 請款金額
    payment_date = models.DateField(null=True, blank=True)  # 收款日期
    invoice_issue_date = models.DateField(null=True, blank=True)  # 發票日期
    invoice_notes = models.TextField(null=True, blank=True)  # 請款備註
    is_paid = models.BooleanField(default=False)  # 是否收款
    custom_fields = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = (
            "year",
            "category",
            "project_number",
        )  # 年份+案件類別+編號不可重複

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # 只有在沒有專案編號的情況下才自動生成
        if not self.project_number:
            try:
                # 查找同年度同類別的最後一個專案
                if self.category:  # 確保類別已設定
                    last_project = (
                        Project.objects.filter(year=self.year, category=self.category)
                        .order_by("-project_number")
                        .first()
                    )
                    if (
                        last_project
                        and last_project.project_number
                        and last_project.project_number.isdigit()
                    ):
                        # 如果有同年度同類別的專案，則編號加1
                        self.project_number = (
                            f"{int(last_project.project_number) + 1:03d}"
                        )
                    else:
                        # 如果是該年度該類別的第一個專案，編號從001開始
                        self.project_number = "001"
            except (ValueError, AttributeError) as e:
                # 處理例外情況，確保程式不會因編號產生錯誤而中斷
                self.project_number = "001"

        super().save(*args, **kwargs)

    def change_count(self):
        """計算專案變更次數"""
        return self.changes.count()

    def update_total_expenditure(self):
        """更新總支出金額"""
        total = self.expenditures.aggregate(total=models.Sum("amount"))["total"] or 0
        self.total_expenditure = total
        self.save(update_fields=["total_expenditure"])

    def set_custom_field(self, name, value):
        """設置自定義欄位值"""
        if not self.custom_fields:
            self.custom_fields = {}

        # 確認欄位存在於類別定義中
        category_fields = self.category.get_custom_fields() if self.category else {}
        if name in category_fields:
            field_type = category_fields[name]["type"]

            # 簡單類型驗證
            if field_type == "number" and not isinstance(value, (int, float)):
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    raise ValueError(f"欄位 {name} 必須是數字")
            elif field_type == "boolean" and not isinstance(value, bool):
                value = bool(value)

            self.custom_fields[name] = value
            self.save(update_fields=["custom_fields"])
            return True
        return False

    def get_custom_field(self, name):
        """獲取自定義欄位值"""
        return self.custom_fields.get(name) if self.custom_fields else None

    def get_all_custom_fields(self):
        """獲取所有自定義欄位值"""
        return self.custom_fields or {}


class Expenditure(models.Model):
    """專案支出模型"""

    project = models.ForeignKey(
        Project, related_name="expenditures", on_delete=models.CASCADE
    )  # 關聯的專案
    amount = models.DecimalField(max_digits=10, decimal_places=0)  # 支出金額
    description = models.TextField()  # 支出說明
    date = models.DateField()  # 消費時間
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )  # 建立者
    created_at = models.DateTimeField(auto_now_add=True)  # 建立時間

    def __str__(self):
        return f"{self.project.name} - {self.amount} - {self.date}"

    class Meta:
        ordering = ["-date"]  # 依日期排序，最新的在前

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # 更新專案的總支出
        self.project.update_total_expenditure()

    def delete(self, *args, **kwargs):
        project = self.project
        super().delete(*args, **kwargs)
        # 更新專案的總支出
        project.update_total_expenditure()


class ProjectChange(models.Model):
    """專案變更記錄模型"""

    project = models.ForeignKey(
        Project, related_name="changes", on_delete=models.CASCADE
    )  # 關聯的專案
    description = models.TextField()  # 變更說明
    created_at = models.DateField()  # 變更建立日期，改為可選擇的日期欄位
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )  # 變更建立者

    def __str__(self):
        return f"{self.project.name} - 變更 #{self.id}"

    class Meta:
        ordering = ["-created_at"]  # 依建立日期排序，最新的在前


class Quotation(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="quotations",  # 修改為更清晰的名稱
    )
    amount = models.DecimalField(max_digits=10, decimal_places=0)  # 報價金額
    date_issued = models.DateField()  # 發行日期

    def __str__(self):
        return f"Quotation for {self.project.name}"


class Company(models.Model):
    """公司資訊模型"""
    name = models.CharField(max_length=255)  # 公司名稱
    responsible_person = models.CharField(max_length=255)  # 負責人
    tax_id = models.CharField(max_length=10, unique=True)  # 統一編號
    address = models.TextField()  # 地址
    phone = models.CharField(max_length=20)  # 電話
    fax = models.CharField(max_length=20, blank=True, null=True)  # 傳真
    contact_person = models.CharField(max_length=255)  # 聯絡人

    def __str__(self):
        return self.name


class Payment(models.Model):
    payment_number = models.CharField(max_length=50, unique=True)  # 請款單號
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE)
    company = models.ForeignKey(
        Company, 
        on_delete=models.PROTECT,  # 使用 PROTECT 避免誤刪有關聯請款單的公司
        related_name='payments'
    )  # 收款公司
    selected_bank_account = models.ForeignKey(
        'BankAccount',  # 使用字符串引用避免循環引用問題
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payments'
    )  # 選定的匯款帳號
    projects = models.ManyToManyField(
        Project, through="PaymentProject", related_name="payments"
    )  # 關聯多個專案
    amount = models.DecimalField(max_digits=10, decimal_places=0)  # 請款總金額
    date_issued = models.DateField()  # 發行日期
    due_date = models.DateField(null=True, blank=True)  # 付款截止日期
    paid = models.BooleanField(default=False)  # 是否已付款
    payment_date = models.DateField(null=True, blank=True)  # 實際付款日期
    notes = models.TextField(blank=True, null=True)  # 備註
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )  # 建立者
    created_at = models.DateTimeField(auto_now_add=True)  # 建立時間

    def __str__(self):
        return f"Payment #{self.payment_number}"

    def get_total_amount(self):
        """計算所有相關專案的請款金額總和"""
        return sum(pp.amount for pp in self.paymentproject_set.all())

    def update_amount(self):
        """更新請款總金額"""
        self.amount = self.get_total_amount()
        self.save(update_fields=["amount"])


class PaymentProject(models.Model):
    """請款單與專案的關聯表"""

    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, null=True
    )  # 關聯的請款單
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, null=True
    )  # 關聯的專案
    quotation = models.ForeignKey(
        Quotation, on_delete=models.SET_NULL, null=True, blank=True
    )  # 引用的報價單（可選）
    amount = models.DecimalField(max_digits=10, decimal_places=0)  # 此專案的請款金額
    description = models.TextField(blank=True, null=True)  # 此專案請款說明

    def __str__(self):
        return f"{self.payment.payment_number} - {self.project.name}"

    class Meta:
        unique_together = ("payment", "project")  # 確保一個請款單中一個專案只出現一次

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # 更新請款單總金額
        self.payment.update_amount()

    def delete(self, *args, **kwargs):
        payment = self.payment
        super().delete(*args, **kwargs)
        # 更新請款單總金額
        payment.update_amount()


class Invoice(models.Model):
    """發票模型"""

    PAYMENT_METHOD_CHOICES = [
        ('cash', '現金'),
        ('bank_transfer', '銀行轉帳'),
        ('check', '支票'),
        ('credit_card', '信用卡'),
        ('other', '其他'),
    ]

    INVOICE_TYPE_CHOICES = [
        ('normal', '正常開立'),
        ('no_invoice', '不開發票'),
        ('pending', '發票待開'),
    ]

    PAYMENT_STATUS_CHOICES = [
        ('paid', '已付款'),
        ('unpaid', '未付款'),
        ('partially_paid', '付款未完成'),
    ]

    invoice_type = models.CharField(
        max_length=20,
        choices=INVOICE_TYPE_CHOICES,
        default='normal'
    )  # 發票類型
    invoice_number = models.CharField(max_length=50, blank=True, null=True)  # 發票號碼，改為可空白
    payment = models.ForeignKey(
        Payment, related_name="invoices", on_delete=models.CASCADE, null=True
    )  # 關聯的請款單
    amount = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)  # 發票金額(未稅)，改為可空白
    issue_date = models.DateField(null=True, blank=True)  # 發票開立日期，改為可空白
    tax_amount = models.DecimalField(max_digits=10, decimal_places=0, default=0, null=True, blank=True)  # 稅額，改為可空白
    payment_status = models.CharField(
        max_length=20,
        choices=PAYMENT_STATUS_CHOICES,
        default='unpaid'
    )  # 付款狀態，使用新的三種狀態
    is_paid = models.BooleanField(default=False)  # 保留舊欄位以保持向後相容
    payment_received_date = models.DateField(null=True, blank=True)  # 收款日
    account_entry_date = models.DateField(null=True, blank=True)  # 入帳日
    payment_method = models.CharField(
        max_length=20,
        choices=PAYMENT_METHOD_CHOICES,
        blank=True,
        null=True
    )  # 收款方式
    actual_received_amount = models.DecimalField(
        max_digits=10, decimal_places=0, null=True, blank=True
    )  # 實收金額
    notes = models.TextField(blank=True, null=True)  # 備註
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )  # 建立者
    created_at = models.DateTimeField(auto_now_add=True)  # 建立時間

    def __str__(self):
        if self.invoice_type == 'no_invoice':
            return f"不開發票 - {self.payment.payment_number if self.payment else 'N/A'}"
        elif self.invoice_type == 'pending':
            return f"發票待開 - {self.payment.payment_number if self.payment else 'N/A'}"
        else:
            return f"Invoice #{self.invoice_number}"

    def save(self, *args, **kwargs):
        # 同步 payment_status 到 is_paid 欄位以保持向後相容
        self.is_paid = (self.payment_status == 'paid')
        super().save(*args, **kwargs)

    class Meta:
        # 移除 unique=True 限制，因為不開發票和發票待開可能沒有發票號碼
        pass


class BankAccount(models.Model):
    """銀行帳戶模型"""
    company = models.ForeignKey(Company, related_name='bank_accounts', on_delete=models.CASCADE)  # 所屬公司
    account_number = models.CharField(max_length=50)  # 銀行帳戶
    account_name = models.CharField(max_length=255)  # 戶名
    bank_name = models.CharField(max_length=255)  # 銀行及分行名稱
    bank_code = models.CharField(max_length=10)  # 機構代碼

    def __str__(self):
        return f"{self.company.company_name} - {self.account_number}"

    class Meta:
        unique_together = ('company', 'account_number') # 同一公司下的帳戶號碼應唯一


def payment_document_upload_path(instance, filename):
    """
    生成內存請款單檔案的上傳路徑
    格式: payment_documents/{year}/{payment_number}/{檔案名稱}
    payment_number 會自動處理特殊字元
    """
    import re
    year = timezone.now().year
    payment_number = instance.payment.payment_number
    # 將 payment_number 轉為安全字元（僅保留中英文、數字、底線、減號，其餘轉為底線）
    safe_payment_number = re.sub(r'[^\w\u4e00-\u9fff-]', '_', payment_number)

    # 取得原檔名（不含副檔名）和副檔名
    name, ext = os.path.splitext(filename)
    # 生成檔案名：{原檔名}_{請款單號}_內存請款單
    new_filename = f"{name}_{payment_number}_內存請款單{ext}"
    # 檢查是否有重複檔名，如果有則加上數字後綴
    base_path = f"payment_documents/{year}/{safe_payment_number}/"
    full_path = os.path.join(base_path, new_filename)
    counter = 1
    while PaymentDocument.objects.filter(
        payment=instance.payment, 
        file__icontains=new_filename
    ).exists():
        name_with_counter = f"{name}_{payment_number}_內存請款單({counter})"
        new_filename = f"{name_with_counter}{ext}"
        full_path = os.path.join(base_path, new_filename)
        counter += 1
    return full_path


class PaymentDocument(models.Model):
    """內存請款單檔案模型"""
    
    payment = models.ForeignKey(
        Payment, 
        related_name='documents', 
        on_delete=models.CASCADE
    )  # 關聯的請款單
    
    file = models.FileField(
        upload_to=payment_document_upload_path,
        max_length=500
    )  # 檔案
    
    original_filename = models.CharField(max_length=255)  # 原始檔名
    
    file_size = models.PositiveIntegerField()  # 檔案大小（bytes）
    
    uploaded_by = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )  # 上傳者
    uploaded_at = models.DateTimeField(auto_now_add=True)  # 上傳時間
    
    def __str__(self):
        return f"{self.payment.payment_number} - {self.original_filename}"
    
    def save(self, *args, **kwargs):
        # 在儲存前設定檔案大小
        if self.file:
            self.file_size = self.file.size
        super().save(*args, **kwargs)
    
    def get_display_filename(self):
        """取得顯示用的檔案名稱（使用原始檔名）"""
        return self.original_filename
    
    def get_file_size_display(self):
        """取得人類可讀的檔案大小"""
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size // 1024} KB"
        else:
            return f"{self.file_size // (1024 * 1024)} MB"
    
    class Meta:
        ordering = ['-uploaded_at']  # 按上傳時間倒序排列
