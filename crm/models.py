from django.contrib.auth.models import User  # 改用 Django 內建的 User 模型
from django.db import models


class Owner(models.Model):
    company_name = models.CharField(max_length=255)  # 公司名稱
    tax_id = models.CharField(max_length=10, unique=True)  # 統一編號，確保不重複
    phone = models.CharField(max_length=20)  # 電話
    fax = models.CharField(max_length=20)  # 傳真
    email = models.EmailField()  # Email
    mobile = models.CharField(max_length=20)  # 手機
    address = models.TextField()  # 地址
    contact_person = models.CharField(max_length=255)  # 聯絡人

    def __str__(self):
        return self.company_name  # 修正為使用 company_name 屬性


class Category(models.Model):
    code = models.CharField(max_length=50, unique=True)  # 編號
    description = models.TextField()  # 說明

    def __str__(self):
        return self.code


class Project(models.Model):
    owner = models.ForeignKey(Owner, on_delete=models.CASCADE)  # 所屬業主
    year = models.IntegerField()  # 年份
    project_number = models.CharField(max_length=3)  # 案件編號，隨年度自動遞增
    name = models.CharField(max_length=255)  # 案件名稱
    manager = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True
    )  # 案件負責人
    drawing = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="drawing_user"
    )  # 繪圖
    drawing_other = models.CharField(
        max_length=255, blank=True, null=True
    )  # 其他繪圖人員名字
    contact_info = models.TextField()  # 聯絡方式
    change_count = models.IntegerField()  # 變更次數
    change_description = models.TextField()  # 變更說明
    notes = models.TextField()  # 備註
    is_completed = models.BooleanField(default=False)  # 是否完成
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True
    )  # 案件類別
    expenditure = models.DecimalField(max_digits=10, decimal_places=2)  # 支出
    is_invoiced = models.BooleanField(default=False)  # 是否請款
    invoice_date = models.DateField(null=True, blank=True)  # 請款日期
    invoice_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )  # 請款金額
    payment_date = models.DateField(null=True, blank=True)  # 收款日期
    invoice_issue_date = models.DateField(null=True, blank=True)  # 發票日期
    invoice_notes = models.TextField(null=True, blank=True)  # 請款備註
    is_paid = models.BooleanField(default=False)  # 是否收款

    class Meta:
        unique_together = (
            "year",
            "category",
            "project_number",
        )  # 年份+案件類別+編號不可重複

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.project_number:
            last_project = (
                Project.objects.filter(year=self.year)
                .order_by("-project_number")
                .first()
            )
            if last_project:
                self.project_number = f"{int(last_project.project_number) + 1:03d}"
            else:
                self.project_number = "001"
        super().save(*args, **kwargs)


class Quotation(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="quotations",  # 修改為更清晰的名稱
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # 報價金額
    date_issued = models.DateField()  # 發行日期

    def __str__(self):
        return f"Quotation for {self.project.name}"


class Invoice(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE)  # 所屬報價單
    amount = models.DecimalField(max_digits=10, decimal_places=2)  # 請款金額
    date_issued = models.DateField()  # 發行日期
    paid = models.BooleanField(default=False)  # 是否已付款

    def __str__(self):
        return f"Invoice for {self.quotation.project.name}"
