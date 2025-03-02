from django.contrib import admin
from .models import Owner, Project, Quotation, Invoice

admin.site.register(Owner)  # 註冊業主資料模型
admin.site.register(Project)  # 註冊案件資料模型
admin.site.register(Quotation)  # 註冊報價單模型
admin.site.register(Invoice)  # 註冊請款單模型
